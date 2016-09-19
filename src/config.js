var reconfig      = require('reconfig');
var yaml          = require('js-yaml');
var fs            = require('fs');
var path          = require('path');
var argv          = require('yargs').argv;
var _             = require('lodash');
var url           = require('url');
var logger        = require('./logger');
var userConfig    = {};

try {
 var userConfig    = yaml.safeLoad(fs.readFileSync(path.join(argv.config), 'utf8'));
} catch (err) {
  logger.info('Unable to find config file, proceeding with a bare minimum configuration');
  logger.info('You might want to fix this unless you are passing config values through environment variables (ROGER_CONFIG_...)');
}

var config        = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'config', 'base.yml'), 'utf8'));

_.assign(config, userConfig);

module.exports = new reconfig(config, 'ROGER_CONFIG');
