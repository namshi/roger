var _          = require('lodash');
var moment     = require('moment');
var yaml       = require('js-yaml');
var fs         = require('fs');
var url        = require('url');
var dispatcher = require('./dispatcher');
var storage    = {};

/**
 * Initializing the DB.
 */
try {
  var data    = yaml.safeLoad(fs.readFileSync('/db/data.yml'));
} catch (err){
  var data = {builds: {}};
}

/**
 * Flush changes to disk.
 */
storage.flush = function(){
  fs.writeFileSync('/db/data.yml', yaml.safeDump(data));
  dispatcher.emit('storage-updated');
}

/**
 * Saves build information.
 */
storage.saveBuild = function(id, tag, project, branch, status) {
  data.builds[id] = {
    branch: branch,
    project: project,
    status: status,
    id: id,
    tag: tag,
    created_at: data.builds[id] ? data.builds[id].created_at : moment().format(),
    updated_at: moment().format()
  }
  
  storage.flush();
};

/**
 * Returns all builds of a project,
 * DESC sorted.
 */
storage.getBuilds = function(limit) {
  limit = limit || 10
  
  return _.sortBy(data.builds, function(build) {
    return - moment(build.updated_at).unix()
  }).slice(0, limit);
};

/**
 * Returns all projects,
 * DESC sorted by latest build.
 */
storage.getProjects = function(limit) {
  limit = limit || 10
  var projects = [];
  
  _.each(_.sortBy(data.builds, function(build) {
    return - moment(build.updated_at).unix()
  }), function(build){
    var u = url.parse(build.project)
    var alias = u.pathname
    var parts = alias.split('__')
    
    if (parts.length === 2) {
      alias = parts[1] + ' (' + parts[0].substr(1)  + ')'
    }
    
    projects.push({
      name: build.project,
      alias: alias,
      latest_build: build
    })
  });
  
  return projects.slice(0, limit);
};

/**
 * Returns all builds of a project,
 * DESC sorted.
 */
storage.getBuildsByProject = function(projectName) {
  var builds = _.where(data.builds, {project: projectName});
  
  return _.sortBy(builds, function(build) {
    return - moment(build.updated_at).unix()
  });
};

/**
 * Returns a particular build for a project.
 */
storage.getBuildByProject = function(id, projectName) {
  return _.where(data.builds, {project: projectName, id: id})[0];
};

/**
 * Returns a particular build for a project.
 */
storage.getBuild = function(id) {
  return _.where(data.builds, {id: id})[0];
};

module.exports = storage;