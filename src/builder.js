var docker          = require('./docker');
var config          = require('./config');
var storage         = require('./storage');
var logger          = require('./logger');
var utils           = require('./utils');
var publisher       = require('./publisher');
var hooks           = require('./hooks');
var notifications   = require('./notifications');
var fs              = require('fs');
var p               = require('path');
var moment          = require('moment');
var git             = require('./git');
var matching        = require('./matching');
var tar             = require('./tar');
var url             = require('url');
var _               = require('lodash');
var yaml            = require('js-yaml');

/**
 * Returns a logger for a build,
 * which is gonna extend the base
 * logger by writing also on the
 * filesystem.
 */
function getBuildLogger(uuid) {
  var logFile = p.join(utils.path('logs'), uuid + '.log');
  var buildLogger = new logger.Logger;
  buildLogger.add(logger.transports.File, { filename: logFile, json: false });
  buildLogger.add(logger.transports.Console, {timestamp: true});

  return buildLogger;
}

/**
 * This is the main builder object,
 * responsible to schedule builds,
 * talk to docker, send notifications
 * etc etc.
 *
 * @type {Object}
 */
var builder = {};

/**
 * Schedules builds for a repo.
 *
 * It will clone the repo and read the build.yml
 * file, then trigger as many builds as we find
 * in the configured build.yml.
 *
 * @param  {string}  repo
 * @param  {string}  gitBranch
 * @param  {string}  uuid
 * @param  {object}  dockerOptions
 * @param  {boolean} checkBranch - Enable branch checking by setting to true
 * @return {void}
 */
builder.schedule = function(repo, gitBranch, uuid, dockerOptions, checkBranch = false) {
  var path        = p.join(utils.path('sources'), uuid);
  var branch      = gitBranch;
  var builds      = [];
  var cloneUrl    = repo;
  dockerOptions   = dockerOptions || {};

  if (branch === 'master') {
    branch = 'latest';
  }

  var githubToken = config.get('auth.github');
  if (githubToken) {
    var uri                 = url.parse(repo);
    uri.auth                = githubToken;
    cloneUrl                = uri.format(uri);
  }

  console.log('cloning: cloneUrl->' + cloneUrl + ', path->' + path + ', gitBranch->' + gitBranch);
  git.clone(cloneUrl, path, gitBranch, logger).then(function() {
    try {
      return yaml.safeLoad(fs.readFileSync(p.join(path, 'build.yml'), 'utf8'));
    } catch(err) {
      logger.error(err.toString(), err.stack);

      /**
       * In case the .build.yml is not found, let's build
       * the smallest possible configuration for the current
       * build: we will take the repo name and build this
       * project, ie github.com/antirez/redis will build
       * under the name "redis".
       */
      var buildConfig = {};
      buildConfig[cloneUrl.split('/').pop()] = {};

      return buildConfig;
    }
  }).then(async function(config) {
    const { settings, ...projects } = config;

    // Check branch name matches rules
    const matchedBranch = !checkBranch || await matching.checkNameRules(settings, gitBranch, path);
    if (!matchedBranch) {
      logger.info('The branch name didn\'t match the defined rules');
      return builds;
    }

    _.each(projects, function(project, name) {
      project.id              = repo + '__' + name;
      project.name            = name;
      project.repo            = repo;
      project.homepage        = repo;
      project['github-token'] = githubToken;
      project.registry        = project.registry || config.get('app.defaultRegistry') || '127.0.0.1:5000';

      console.log('project ' + name + ': ', utils.obfuscate(project));
      if (!!project.build) {
        dockerOptions.dockerfile = project.build.dockerfile;
      }

      builds.push(builder.build(project, uuid + '-' + project.name, path, gitBranch, branch, dockerOptions));
    });

    return builds;
  }).catch(function(err) {
    logger.error(err.toString(), err.stack);
  }).done();
};

/**
 * Builds a project.
 *
 * @param  {object} project
 * @param  {string} uuid
 * @param  {string} path
 * @param  {string} gitBranch
 * @param  {string} branch
 * @param  {object} dockerOptions
 * @return {Promise}
 */
builder.build = function(project, uuid, path, gitBranch, branch, dockerOptions) {
  var buildLogger = getBuildLogger(uuid);
  var tarPath     = p.join(utils.path('tars'), uuid + '.tar');
  var imageId     = project.registry + '/' + project.name;
  var buildId     = imageId + ':' + branch;
  var author      = 'unknown@unknown.com';
  var now         = moment();
  var sha         = '';

  storage.saveBuild(uuid, buildId, project.id, branch, 'queued').then(function() {
    return builder.hasCapacity();
  }).then(function() {
    return storage.saveBuild(uuid, buildId, project.id, branch, 'started');
  }).then(function() {
    return git.getCommit(path, gitBranch);
  }).then(function(commit) {
    author = commit.author().email();
    sha = commit.sha();

    return builder.addRevFile(gitBranch, path, commit, project, buildLogger, {buildId: buildId});
  }).then(function() {
    var dockerfilePath = path;

    if (project.dockerfilePath) {
      dockerfilePath = p.join(path, project.dockerfilePath);
    }

    return tar.create(tarPath,  dockerfilePath + '/', buildLogger, {buildId: buildId});
  }).then(function() {
    var dockerfilePath = path;

    if (project.dockerfilePath) {
      dockerfilePath = p.join(path, project.dockerfilePath);
    }
    var dockerFile = dockerfilePath + '/Dockerfile';
    buildLogger.info('docker file path %s ', dockerFile);

    return docker.extractFromImageName(dockerFile);
  }).then(function(from) {
    return docker.pullImage(buildId, from, imageId, dockerOptions, buildLogger);
  }).then(function() {
    buildLogger.info('[%s] Created tarball for %s', buildId, uuid);

    return docker.buildImage(project, tarPath, imageId + ':' + branch, buildId, buildLogger, dockerOptions, uuid);
  }).then(function(realBuildId) {
    buildLogger.info('[%s] %s built succesfully as imageId: %s', buildId, uuid, realBuildId);
    buildLogger.info('[%s] Tagging %s as imageId: %s', buildId, uuid, realBuildId);

    return docker.tag(imageId, buildId, branch);
  }).then(function(image) {
    return publisher.publish(docker.client, buildId, project, buildLogger).then(function() {
      return image;
    });
  }).then(function(image) {
    buildLogger.info('[%s] Running after-build hooks for %s', buildId, uuid);

    return hooks.run('after-build', buildId, project, docker.client, buildLogger).then(function() {
      return image;
    });
  }).then(function(image) {
    buildLogger.info('[%s] Ran after-build hooks for %s', buildId, uuid);
    buildLogger.info('[%s] Pushing %s to %s', buildId, uuid, project.registry);

    return docker.push(image, buildId, uuid, branch, project.registry, buildLogger);
  }).then(function() {
    return storage.saveBuild(uuid, buildId, project.id, branch, 'passed');
  }).then(function() {
    buildLogger.info('[%s] Finished build %s in %s #SWAG', buildId, uuid, moment(now).fromNow(Boolean));

    return true;
  }).catch(function(err) {
    if (err.name === 'NO_CAPACITY_LEFT') {
      buildLogger.info('[%s] Too many builds running concurrently, queueing this one...', buildId);

      setTimeout(function() {
        builder.build(project, uuid, path, gitBranch, branch, dockerOptions);
      }, config.get('builds.retry-after') * 1000);
    } else {
      return builder.markBuildAsFailed(err, uuid, buildId, project, branch, buildLogger);
    }
  }).then(function(result) {
    if (result) {
      notifications.trigger(project, branch, {author: author, project: project, result: result, logger: buildLogger, uuid: uuid, buildId: buildId, sha: sha});
    }
  }).catch(function(err) {
    buildLogger.error('[%s] Error sending notifications for %s ("%s")', buildId, uuid, err.message || err.error, err.stack);
  }).done();
};

/**
 * Checks whether we are running too many parallel
 * builds.
 *
 * @return {Promise}
 */
builder.hasCapacity = function() {
  return storage.getStartedBuilds().then(function(builds) {
    maxConcurrentBuilds = config.get('builds.concurrent');

    if (maxConcurrentBuilds && builds.length >= maxConcurrentBuilds) {
      utils.throw('NO_CAPACITY_LEFT');
    }
  });
};

/**
 * Adds a revfile at the build path
 * with information about the latest
 * commit.
 */
builder.addRevFile = function(gitBranch, path, commit, project, buildLogger, options) {
  var parts = [path];

  if (project.dockerfilePath) {
    parts.push(project.dockerfilePath);
  }

  if (project.revfile) {
    parts.push(project.revfile);
  }

  var revFilePath = p.join(parts.join('/'), 'rev.txt');

  buildLogger.info('[%s] Going to create revfile in %s', options.buildId, revFilePath);
  fs.appendFileSync(revFilePath, 'Version: ' + gitBranch);
  fs.appendFileSync(revFilePath, '\nDate: ' + commit.date());
  fs.appendFileSync(revFilePath, '\nAuthor: ' + commit.author());
  fs.appendFileSync(revFilePath, '\nSha: ' + commit.sha());
  fs.appendFileSync(revFilePath, '\n');
  fs.appendFileSync(revFilePath, '\nCommit message:');
  fs.appendFileSync(revFilePath, '\n');
  fs.appendFileSync(revFilePath, '\n  ' + commit.message());
  buildLogger.info('[%s] Created revfile in %s', options.buildId, revFilePath);
};

/**
 * Marks the given build as failed.
 *
 * @param  {Error} err
 * @param  {string} uuid
 * @param  {string} buildId
 * @param  {Object} project
 * @param  {string} branch
 * @param  {Object} buildLogger
 * @return {Error}
 */
builder.markBuildAsFailed = function(err, uuid, buildId, project, branch, buildLogger) {
  var message = err.message || err.error || err;

  return storage.saveBuild(uuid, buildId, project.id, branch, 'failed').then(function() {
    buildLogger.error('[%s] BUILD %s FAILED! ("%s") #YOLO', buildId, uuid, message, err.stack);

    return new Error(message);
  });
};

/**
 * Upon booting, look for builds that didn't finish
 * before the last shutdown, then mark them as failed.
 */
logger.info('Looking for pending builds...');
storage.getPendingBuilds().then(function(builds) {
  builds.forEach(function(staleBuild) {
    logger.info('Build %s marked as failed, was pending upon restart of the server', staleBuild.id);
    storage.saveBuild(staleBuild.id, staleBuild.tag, staleBuild.project, staleBuild.branch, 'failed');
  });
});

module.exports = builder;
