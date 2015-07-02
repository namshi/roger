var reconfig      = require('reconfig');
var yaml          = require('js-yaml');
var fs            = require('fs');
var path          = require('path');
var argv          = require('yargs').argv;
var _             = require('lodash');
var url           = require('url');
var logger        = require('./logger');
var userConfig    = yaml.safeLoad(fs.readFileSync(path.join(argv.config), 'utf8'));
var config        = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'config', 'base.yml'), 'utf8'));

_.assign(config, userConfig);

module.exports = new reconfig(config, 'ROGER_CONFIG');