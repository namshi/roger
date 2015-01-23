var reconfig  = require('reconfig');
var yaml      = require('js-yaml');
var fs        = require('fs');
var path      = require('path');
var argv      = require('yargs').argv;
var _         = require('lodash');
var url       = require('url');
var config    = yaml.safeLoad(fs.readFileSync(path.join(__dirname, argv.config), 'utf8'));

/**
 * Add the project name
 * to each project's configuration.
 */
_.each(config.projects, function(project, name) {
  config.projects[name].name = name;
  var githubToken = project.github_token || config.app.github_token;
  
  if (githubToken) {
    var uri       = url.parse(project.from);
    uri.auth      = githubToken;
    project.from  = uri.format();
  }
})

module.exports = new reconfig(config, 'ROGER_CONFIG');