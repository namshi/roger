var Q       = require('q');
var _       = require('lodash');
var logger  = require('./logger');
var hooks = {};

/**
 * Utility function that runs the hook
 * in a container and resolves / rejects
 * based on the hooks exit code.
 */
function promisifyHook(dockerClient, buildId, command) {
  var deferred = Q.defer();
  
  dockerClient.run(buildId, command.split(' '), process.stdout, function (err, data, container) {
    if (err) {
      deferred.reject(err);
    } else if (data.StatusCode === 0) {
      deferred.resolve();
    } else {
      deferred.reject(command + ' failed, exited with status code ' + data.StatusCode);
    }
  });  
  
  return deferred.promise;
}

/**
 * Run all hooks for a specified event on a container
 * built from the buildId, ie. my_node_app:master
 * 
 * If any of the hooks fails, the returning promise
 * will be rejected.
 * 
 * @return promise
 */
hooks.run = function(event, buildId, project, dockerClient) {
  var deferred = Q.defer();
  var hooks    = project[event];
  var promises = [];
  
  if (_.isArray(hooks)) {
    logger.info('[%s] Running %s hooks', buildId, event);
    
    _.each(hooks, function(command) {
      logger.info('[%s] Running %s hook "%s"', buildId, event, command);
      
      promises.push(promisifyHook(dockerClient, buildId, command));
    });
    
    return Q.all(promises); 
  } else {
    logger.info('[%s] No %s hooks to run', buildId, event);
    deferred.resolve();
  }
  
  return deferred.promise;
};

module.exports = hooks;