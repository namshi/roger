var docker  = require('./docker')
var config  = require('./config')
var storage = require('./storage')
var logger  = require('./logger')

/**
 * This is the main builder object,
 * responsible to schedule builds,
 * talk to docker, send notifications
 * etc etc.
 *
 * Currently, most of its responsibilities
 * reside in the docker module -- the plan
 * is to migrate most of the stuff from
 * there to this module
 *
 * @type {Object}
 */
var builder = {}

/**
 * Checks whether we are running too many parallel
 * builds.
 *
 * @return {Boolean}
 */
builder.hasCapacity = function() {
  maxConcurrentBuilds = config.get('builds.concurrent')

  return !!(!maxConcurrentBuilds || storage.getStartedBuilds().length < maxConcurrentBuilds)
}

/**
 * Schedules a build to run in a while.
 *
 * @param  {function} build
 * @return {void}
 */
builder.delay = function(build){
  setTimeout(function(){
    build()
  }, config.get('builds.retry-after') * 1000);
}

logger.info('Looking for pending builds...');
storage.getPendingBuilds().forEach(function(staleBuild){
  logger.info('Build %s marked as failed, was pending upon restart of the server', staleBuild.id)
  storage.saveBuild(staleBuild.id, staleBuild.tag, staleBuild.project, staleBuild.branch, 'failed');
})

module.exports = builder;
