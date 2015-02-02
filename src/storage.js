var _       = require('lodash');
var moment  = require('moment');
var yaml    = require('js-yaml');
var fs      = require('fs');
var storage = {};

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

module.exports = storage;