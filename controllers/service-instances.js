/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2016. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/
"use strict";

require("i18n");

var express = require("express"),
	router = express.Router(),
	config = require("../util/config"),
    saucelabs = require("../util/saucelabs"),
    database = require("../util/database"),
    log4js = require("log4js"),
    logger = log4js.getLogger("service-instance"),
	msgs = require("../nls/msgs.properties");

router.put("/:sid", createOrUpdateServiceInstance);
router.patch("/:sid", createOrUpdateServiceInstance);
router.put("/:sid/toolchains/:tid", bindServiceInstance);
router.delete("/:sid", deleteServiceInstance);
router.delete("/:sid/toolchains", unbindServiceInstanceFromAllToolchains);
router.delete("/:sid/toolchains/:tid", unbindServiceInstanceFromToolchain);

module.exports = router;

database.init();

function createOrUpdateServiceInstance (req, res) {

	var sid = req.params.sid,
	    params = ["dashboard_url", "parameters", "organization_guid"],
	    paramsToUpdate = [];

	for (var i = 0; i < params.length; i++){
		if (req.body[params[i]]){
			paramsToUpdate.push(params[i]);
		}
	}

	if (paramsToUpdate.indexOf("organization_guid") === -1 && req.method === "PUT"){
		return res.status(400).json({ "description": msgs.get("error.org_missing", req)});
	}

	if (paramsToUpdate.indexOf("parameters") !== -1 && !validateParameters(req.body.parameters)){
		res.status(400).json({description: msgs.get("error.usernamekey_missing", req)});
		return;
	}

	database.getDocument(sid, function(doc){
		if (doc){
			updateDocument(doc, req, res, paramsToUpdate);
		} else {
			createDocument(req, res, paramsToUpdate);
		}
	});
}

function validateParameters(params){
	var required = ["username","key"];
	try {
		for (var i = 0; i < required.length; i++){
			if (!(params[required[i]] && params[required[i]].length > 0)) {
				return false;
			}
		}
		return true;
	} catch (e) {
		return false;
	}
}

function createDocument(req, res, paramsToUpdate) {
	var doc = {},
		i;
	doc._id = req.params.sid;
	for (i = 0; i < paramsToUpdate.length; i++){
	    doc[paramsToUpdate[i]] = req.body[paramsToUpdate[i]];
	}
	if(paramsToUpdate.indexOf("dashboard_url") === -1){
	    doc.dashboard_url = config.dashboardUrl;
	}
	validateAndInsert(doc, req, res);
}

function updateDocument(doc, req, res, paramsToUpdate){
	var i;
	for (i = 0; i < paramsToUpdate.length; i++){
		if (paramsToUpdate[i] !== "organization_guid"){
			doc[paramsToUpdate[i]] = req.body[paramsToUpdate[i]];
		}
	}
	validateAndInsert(doc, req, res);
}

function validateAndInsert(doc, req, res) {
	saucelabs.validateCredentials(doc.parameters, function(ok){
		if(!ok){
			res.status(400).json({description: msgs.get("error.sauce_creds", req)});
			return;
		}
	    database.insertDocument(doc, function(result) {
			if (result) {
				var json = {};
				doc.parameters.label = doc.parameters.username;
				json = {
					instance_id: doc._id,
					dashboard_url: doc.dashboard_url,
					parameters: doc.parameters
				};
				res.status(200).json(json);
			} else {
				logger.error("Could not write to database");
				res.status(400).json({description: msgs.get("error.database_write", req)});
			}
	    });
	});
}

function bindServiceInstance (req, res) {
	var sid = req.params.sid,
		tid = req.params.tid;

	database.getDocument(sid, function(doc){
		if (doc){
			var binds = doc.binds || [];
			if (binds.indexOf(tid) !== -1){
				logger.error("Toolchain " + tid + " already bound to service instance " + sid);
				res.status(400).json({description: msgs.get("error.alreadybound", [sid], req)});
				return;
			}
			binds.push(tid);
			doc.binds = binds;
			database.insertDocument(doc, function(result) {
				if (result) {
					res.status(204).end();
				} else {
					logger.error("Failed to bind toolchain " + tid + " to service instance " + sid);
					res.status(400).json({description: msgs.get("error.failedtobind",[tid, sid], req)});
				}
			});
		} else {
			logger.error("Bind - no such service instance: " + sid);
			res.status(404).json({description: msgs.get("error.nosuchinstance", [sid], req)});
		}
	});
}

function deleteServiceInstance (req, res) {
	var sid = req.params.sid;

	database.getDocument(sid, function(doc){
		if (doc){
			database.deleteDocument(doc, function(result) {
				if (result) {
					res.status(204).end();
				} else {
					logger.error("Failed to delete service instance: " + sid);
					res.status(500).json({description: msgs.get("error.deletefail", [sid], req)});
				}
			});
		} else {
			logger.error("Delete - No such service instance: " + sid);
			res.status(404).json({description: msgs.get("error.nosuchinstance", [sid], req)});
		}
	});
}

function unbindServiceInstanceFromAllToolchains(req, res) {
	var sid = req.params.sid;

	database.getDocument(sid, function(doc){
		if (doc){
			doc.binds = [];
			database.insertDocument(doc, function(result) {
				if (result) {
					res.status(204).end();
				} else {
					logger.error("Failed to unbind all toolchains from service instance " + sid);
					res.status(400).json({description: msgs.get("error.unbindall", req)});
				}
			});
		} else {
			logger.error("No such service instance: " + sid);
			res.status(404).json({description: msgs.get("error.nosuchinstance", [sid], req)});
		}
	});
}

function unbindServiceInstanceFromToolchain (req, res) {
	var sid = req.params.sid,
		tid = req.params.tid;

	database.getDocument(sid, function(doc){
		if (doc){
			var binds = doc.binds || [],
				idx = binds.indexOf(tid);
			if (idx === -1) {
				logger.error("No such bound toolchain: " + tid + " for service instance " +sid);
				res.status(404).json({description: msgs.get("error.notbound", [tid, sid], req)});
				return;
			} else {
				binds.splice(idx, 1);
			}
			doc.binds = binds;
			database.insertDocument(doc, function(result) {
				if (result) {
					res.status(204).end();
				} else {
					logger.error("Failed to unbind toolchain " + tid + " to service instance " + sid);
					res.status(400).json({description: msgs.get("error.unbind", [tid, sid], req)});
				}
			});
		} else {
			logger.error("Unbind - No such service instance: " + sid + " (command ignored)");
			res.status(204).end();
		}
	});
}