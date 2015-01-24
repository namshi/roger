var express = require('express')
var _       = require('lodash')
var logger  = require('./logger');
var config  = require('./config');
var routes  = require('./routes');
var utils   = require('./utils');

/**
 * Print the config while booting,
 * but omit the sensitive stuff.
 */
logger.info('using config:', JSON.stringify(utils.obfuscate(config.get())));

/**
 * Register the routes.
 */
var app = express();
routes.bind(app);

/**
 * Start the fun!
 * 
 * #swag
 */
var port = 5000;
app.listen(port);
console.log('Roger running on port', port);