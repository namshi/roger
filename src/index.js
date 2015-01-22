var express = require('express')
var logger  = require('./logger');
var config  = require('./config');
var routes  = require('./routes');

/**
 * Print the config while booting
 */
logger.info('using config:', JSON.stringify(config.get()))

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
var port = config.get('app.port') || 3000;
app.listen(port);
console.log('Roger running on port', port);