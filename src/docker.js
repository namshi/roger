var git     = require('./git');
var config  = require('./config');
var logger  = require('./logger');
var docker  = {};

/**
 * Clones and build the branch of the
 * project.
 * 
 * @return promise
 */
docker.build = function(project, branch) {
  var timestamp = Date.now() / 1000 | 0;
  var path = '/tmp/roger-builds/' + project + '/' + timestamp;
  
  branch = branch || project.branch || 'master';
  logger.info('Scheduled a build of %s:%s', project.name, branch);
  
  return git.clone(project.from, path, {checkoutBranch: branch});
};

module.exports = docker;