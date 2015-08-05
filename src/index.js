var express = require('express')
var _       = require('lodash')
var logger  = require('./logger');
var config  = require('./config');
var routes  = require('./routes');
var utils   = require('./utils');
var socket  = require('./socket');
var auth    = require('./auth');

/**
 * Print the config while booting,
 * but omit the sensitive stuff.
 */
logger.info('using config:', JSON.stringify(utils.obfuscate(config.get())));

/**
 * Register the routes.
 */
var app = express();

if (config.get('app.auth')) {
  auth.enable(app)
}

routes.bind(app);

/**
 * Start the fun!
 *
 * #swag
 */
var port = 6600;
var server = app.listen(port);
// enable websockets support
socket(server);
console.log('Roger running on port', port);
