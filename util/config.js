/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2016. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/

var config = require("../config/config.json");

function getDbSettings(env) {
	return require("../config/" + env + "-database.json");
}

module.exports = {
	env: process.env.APPLICATION_ENV || config.env,

	contextRoot: process.env.CONTEXT_ROOT || config.contextRoot,
	contextPath: process.env.CONTEXT_PATH || config.contextPath,
	buildNumber: process.env.BUILD_NUMBER,
	dashboardUrl: process.env.DASHBOARD_URL || config.dashboardUrl,

	tiam_url: process.env.TIAM_URL || config.tiam_url,
    tiam_client_id: process.env.TIAM_CLIENT_ID || config.tiam_client_id,
    tiam_client_secret: process.env.TIAM_CLIENT_SECRET  || config.tiam_client_secret,

	db_name: process.env.DB_NAME || config.db_name,
	getDbSettings: getDbSettings
};