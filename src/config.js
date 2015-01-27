var reconfig  = require('reconfig');
var yaml      = require('js-yaml');
var fs        = require('fs');
var path      = require('path');
var argv      = require('yargs').argv;
var _         = require('lodash');
var url       = require('url');
var logger    = require('./logger');
var config    = yaml.safeLoad(fs.readFileSync(path.join(argv.config), 'utf8'));

/**
 * Add the project name
 * to each project's configuration.
 */
_.each(config.projects, function(project, name) {
  config.projects[name].name = name;
  
  /**
   * If there is a github token set for this
   * project or for the whole apps, rewrite
   * the git clone URL to include that token
   * in the URL.
   */
  var githubToken = project['github-token'] || config.auth['github'];
  
  if (githubToken) {
    var uri       = url.parse(project.from);
    uri.auth      = githubToken;
    project.from  = uri.format();
  }
  
  /**
   * If you don't set the registry for
   * a project we'll assume you want
   * to push to the DockerHub at
   * hub.docker.com and rewrite the
   * registry into your name so that
   * pushes will look like
   * docker push username/redis:master
   */
  if (!project.registry) {
    if (!config.auth || !config.auth.dockerhub || !config.auth.dockerhub.username || !config.auth.dockerhub.email || !config.auth.dockerhub.password) {
      logger.error('It seems that the project "%s" should be pushed to the dockerhub', project.name);
      logger.error('but you forgot to add your credentials in the config file "%s"', argv.config);
      logger.error();
      logger.error('Please specify:');
      logger.error(' - username');
      logger.error(' - email address');
      logger.error(' - password');
      logger.error();
      logger.error('See https://github.com/namshi/roger#configuration');
      
      throw new Error('Fatality! MUAHAHUAAHUAH!');
    }
    
    project.registry = config.auth.dockerhub.username;
  }
})

module.exports = new reconfig(config, 'ROGER_CONFIG');