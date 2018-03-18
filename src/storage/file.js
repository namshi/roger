var _          = require('lodash');
var moment     = require('moment');
var yaml       = require('js-yaml');
var fs         = require('fs');
var url        = require('url');
var Q          = require('q');

/**
 * This is the simplest storage system
 * available in roger.
 *
 * It keeps a record of all builds in memory
 * and flushes them to disk every time a build
 * is saved.
 *
 * It is also quite dummy since, not having
 * a powerful engine to rely on, saves
 * everything in a single list of builds -- so,
 * for example, when you query for projects
 * it loops all builds and extracts the
 * projects.
 *
 * This storage is implemented to simply get
 * started with Roger, but you should consider
 * a more persistent (and serious :-P) engine
 * for production installations.
 *
 * @type {Object}
 */
var file       = {};
var data = {builds: {}};

/**
 * Initializing the DB.
 */
try {
  data = yaml.safeLoad(fs.readFileSync('/db/data.yml'));
} catch (err) {
  console.error(err);
}

/**
 * Flush changes to disk.
 */
function flush() {
  try {
    fs.mkdirSync('/db');
  } catch(err) {
    if ( err.code !== 'EEXIST' ) {
      throw err;
    }
  }

  fs.writeFileSync('/db/data.yml', yaml.safeDump(data));
}

file.saveBuild = function(id, tag, project, branch, status) {
  data.builds[id] = {
    branch: branch,
    project: project,
    status: status,
    id: id,
    tag: tag,
    'created_at': data.builds[id] ? data.builds[id]['created_at'] : moment().format(),
    'updated_at': moment().format()
  };

  flush();

  return Q.Promise(function(resolve) {
    resolve();
  });
};

file.getBuilds = function(limit) {
  return Q.Promise(function(resolve) {
    limit = limit || 10;

    var builds = _.sortBy(data.builds, function(build) {
      return - moment(build['updated_at']).unix();
    }).slice(0, limit);

    resolve(builds);
  });
};

file.getBuildsByStatus = function(statuses) {
  return Q.Promise(function(resolve) {
    var builds = _.where(data.builds, function(build) {
      return _.contains(statuses, build.status);
    });

    resolve(builds);
  });
};

file.getProjects = function(limit) {
  return Q.Promise(function(resolve) {
    limit = limit || 10;
    var projects = [];

    _.each(_.sortBy(data.builds, function(build) {
      return - moment(build['updated_at']).unix();
    }), function(build) {
      var u = url.parse(build.project);
      var alias = u.pathname;
      var parts = alias.split('__');

      if (parts.length === 2) {
        alias = parts[1] + ' (' + parts[0].substr(1)  + ')';
      }

      projects.push({
        name: build.project,
        alias: alias,
        'latest_build': build
      });
    });

    resolve(_.uniq(projects, 'name').slice(0, limit));
  });
};

file.getBuild = function(id) {
  return Q.Promise(function(resolve, reject) {
    var build = _.where(data.builds, {id: id})[0];

    if (build) {
      resolve(build);
      return;
    }

    reject();
  });
};

module.exports = file;
