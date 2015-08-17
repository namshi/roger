var dispatcher = require('./dispatcher')
var config     = require('./config')
var adapter    = require('./storage/' + config.get('app.storage'))

/**
 * The storage object is simply
 * responsible for proxying a
 * storage adapter (ie. mysql)
 * and defining the interface
 * that the adapter needs to
 * implement.
 *
 * If you wish to implement your own
 * storage solution, you will only
 * need to implement the methods
 * exported here.
 *
 * For an exaple implementation,
 * see storage/file.js, our super-dummy
 * file-based storage system.
 *
 * @type {Object}
 */
module.exports = {
  /**
   * Saves build information.
   */
  saveBuild: function(id, tag, project, branch, status){
    return adapter.saveBuild(id, tag, project, branch, status).then(function(result){
      dispatcher.emit('storage-updated');

      return result;
    })
  },
  /**
   * Returns all builds of a project,
   * DESC sorted.
   */
  getBuilds: function(limit) {
    return adapter.getBuilds(limit)
  },
  /**
   * Returns all started jobs.
   */
  getStartedBuilds: function(){
    return this.getBuildsByStatus(['started'])
  },
  /**
   * Returns all jobs that are either started
   * or queued.
   */
  getPendingBuilds: function(){
    return this.getBuildsByStatus(['started', 'queued'])
  },
  /**
   * Returns a list of builds in the given
   * statuses.
   *
   * @param  {list} statuses
   * @return {list}
   */
  getBuildsByStatus: function(statuses){
    return adapter.getBuildsByStatus(statuses)
  },
  /**
   * Returns all projects,
   * DESC sorted by latest build.
   */
  getProjects: function(limit){
    return adapter.getProjects(limit)
  },
  /**
   * Returns a particular build.
   */
  getBuild: function(id){
    return adapter.getBuild(id)
  }
}
