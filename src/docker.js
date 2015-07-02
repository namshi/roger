var _               = require('lodash');
var moment          = require('moment');
var p               = require('path');
var Docker          = require('dockerode');
var Q               = require('q');
var url             = require('url');
var fs              = require('fs');
var git             = require('./git');
var config          = require('./config');
var storage         = require('./storage');
var logger          = require('./logger');
var notifications   = require('./notifications');
var tar             = require('./tar');
var hooks           = require('./hooks');
var publisher       = require('./publisher');
var yaml            = require('js-yaml');
var client          = new Docker({socketPath: '/tmp/docker.sock'});
var docker          = {};

/**
 * Returns a logger for a build,
 * which is gonna extend the base
 * logger by writing also on the
 * filesystem.
 */
function getBuildLogger(logFile) {
  var buildLogger = new logger.Logger; 
  buildLogger.add(logger.transports.File, { filename: logFile, json: false });
  buildLogger.add(logger.transports.Console, {timestamp: true})
  
  return buildLogger;
}

docker.schedule = function(repo, gitBranch, uuid) {
  var path        = '/tmp/roger-builds/sources/' + uuid
  var branch      = gitBranch
  var builds      = [];
  var cloneUrl    = repo
  
  if (branch === 'master') {
    branch = 'latest'
  }
  
  var githubToken = config.get('auth.github')
  if (githubToken) {
    var uri                 = url.parse(repo);
    uri.auth                = githubToken;
    cloneUrl                = uri.format(uri);
  }
  
  git.clone(cloneUrl, path, gitBranch, logger).then(function(){
    try {
      return yaml.safeLoad(fs.readFileSync(p.join(path, 'build.yml'), 'utf8'));  
    } catch(err) {
      /**
       * In case the .build.yml is not found, let's build
       * the smallest possible configuration for the current
       * build: we will take the repo name and build this
       * project, ie github.com/antirez/redis will build
       * under the name "redis".
       */
      var buildConfig = {}
      buildConfig[cloneUrl.split('/').pop()] = {}
      
      return buildConfig
    }
  }).then(function(projects){
    _.each(projects, function(project, name){
      project.id              = repo + '__' + name
      project.name            = name
      project.repo            = repo
      project.homepage        = repo
      project['github-token'] = githubToken
      project.registry        = project.registry || '127.0.0.1:5000'
      
      builds.push(docker.build(project, uuid + '-' + project.name, path, gitBranch, branch));
    })
    
    return builds;
  }).catch(function(err){
    logger.error(err.toString())
  }).done()
};

docker.build = function(project, uuid, path, gitBranch, branch){
  var buildLogger = getBuildLogger('/tmp/roger-builds/' + uuid  + '.log')
  var tarPath     = '/tmp/roger-builds/' + uuid  + '.tar'
  var imageId     = project.registry + '/' + project.name
  var buildId     = imageId + ':' + branch
  var author      = 'unknown@unknown.com'
  var now         = moment();
  
  storage.saveBuild(uuid, buildId, project.id, branch, 'started');
  
  return git.getLastCommit(path, gitBranch).then(function(commit){
    author = commit.author().email();
    
    return docker.addRevFile(gitBranch, path, commit, project, buildLogger, {buildId: buildId});
  }).then(function(){
    var dockerfilePath = path;
    
    if (project.dockerfilePath) {
      dockerfilePath = p.join(path, project.dockerfilePath);
    }
    
    return tar.create(tarPath,  dockerfilePath + '/');
  }).then(function(){
    buildLogger.info('[%s] Created tarball for %s', buildId, uuid);
    
    return docker.buildImage(project, tarPath, imageId + ':' + branch, buildId, buildLogger); 
  }).then(function(){
    buildLogger.info('[%s] %s built succesfully', buildId, uuid);
    buildLogger.info('[%s] Tagging %s', buildId, uuid);
    
    return docker.tag(imageId, buildId, branch, buildLogger);
  }).then(function(image){
    return publisher.publish(client, buildId, project, logger).then(function(){
      return image;
    });
  }).then(function(image){
    buildLogger.info('[%s] Running after-build hooks for %s', buildId, uuid);
    
    return hooks.run('after-build', buildId, project, client, buildLogger).then(function(){
      return image;
    });
  }).then(function(image){
    buildLogger.info('[%s] Ran after-build hooks for %s', buildId, uuid);
    buildLogger.info('[%s] Pushing %s to %s', buildId, uuid, project.registry);
    
    return docker.push(image, buildId, uuid, branch, project.registry, buildLogger);
  }).then(function(){
    storage.saveBuild(uuid, buildId, project.id, branch, 'passed');
    buildLogger.info('[%s] Finished build %s in %s #SWAG', buildId, uuid, moment(now).fromNow(Boolean));
    
    return true;
  }).catch(function(err){
    var message = err.message || err.error || err;

    storage.saveBuild(uuid, buildId, project.id, branch, 'failed');
    buildLogger.error('[%s] BUILD %s FAILED! ("%s") #YOLO', buildId, uuid, message);
    
    return new Error(message);
  }).then(function(result){
    notifications.trigger(project, branch, {author: author, project: project, result: result, logger: buildLogger, uuid: uuid, buildId: buildId});
  }).catch(function(err){
    buildLogger.error('[%s] Error sending notifications for %s ("%s")', buildId, uuid, err.message || err.error);
  });
}

/**
 * Adds a revfile at the build path
 * with information about the latest
 * commit.
 */
docker.addRevFile = function(gitBranch, path, commit, project, buildLogger, options){
  var parts = [path];

  if (project.dockerfilePath) {
    parts.push(project.dockerfilePath);
  }
  
  if (project.revfile) {
    parts.push(project.revfile);
  }
  
  var revFilePath = p.join(parts.join('/'), 'rev.txt');
  
  buildLogger.info('[%s] Going to create revfile in %s', options.buildId, revFilePath);
  fs.appendFileSync(revFilePath, "Version: " + gitBranch);
  fs.appendFileSync(revFilePath, "\nDate: " + commit.date());
  fs.appendFileSync(revFilePath, "\nAuthor: " + commit.author());
  fs.appendFileSync(revFilePath, "\nSha: " + commit.sha());
  fs.appendFileSync(revFilePath, "\n");
  fs.appendFileSync(revFilePath, "\nCommit message:");
  fs.appendFileSync(revFilePath, "\n");
  fs.appendFileSync(revFilePath, "\n  " + commit.message());
  buildLogger.info('[%s] Created revfile in %s', options.buildId, revFilePath);
}

/**
 * Builds a docker image.
 * 
 * @return promise
 */
docker.buildImage = function(project, tarPath, imageId, buildId, buildLogger) {
  var deferred = Q.defer();
  
  client.buildImage(tarPath, {t: imageId}, function (err, response){
    if (err) {
      deferred.reject(err);
    } else {
      buildLogger.info('[%s] Build is in progress...', buildId);
      
      response.on('data', function(out){
        var result = JSON.parse(out.toString('utf-8'));
        
        if (result.error) {
          buildLogger.error('[%s] %s', buildId, result.error)
          deferred.reject(result.error);
          return;
        }
        
        if (result.progress) {
          result.status = result.status + ' ' + result.progress;
        }
        
        buildLogger.info("[%s] %s", buildId, result.stream || result.status);
      });
      
      response.on('end', function(){
        deferred.resolve();
      });
    }
  });
  
  return deferred.promise;
};

/**
 * Tags "branch" off the latest imageId.
 * 
 * @return promise
 */
docker.tag = function(imageId, buildId, branch, buildLogger) {
  var deferred  = Q.defer();
  var image     = client.getImage(imageId);
  
  image.tag({repo: imageId, tag: branch}, function(){
    deferred.resolve(image);
  })
  
  return deferred.promise;
};

/**
 * Retrieves the authconfig needed
 * in order to push this image.
 * 
 * This method is mainly here if you
 * have builds that need to be pushed
 * to the dockerhub.
 * 
 * @see http://stackoverflow.com/questions/24814714/docker-remote-api-pull-from-docker-hub-private-registry
 */
docker.getAuth = function(buildId, registry, buildLogger) {
  var options = {};
  
  if (registry === 'dockerhub') {
    buildLogger.info('[%s] Image should be pushed to the DockerHub @ hub.docker.com', buildId);
    
    options = config.get('auth.dockerhub');
    
    if (!options || !options.username || !options.email || !options.password) {
      buildLogger.error('It seems that the build "%s" should be pushed to the dockerhub', buildId);
      buildLogger.error('but you forgot to add your credentials in the config file "%s"', argv.config);
      buildLogger.error();
      buildLogger.error('Please specify:');
      buildLogger.error(' - username');
      buildLogger.error(' - email address');
      buildLogger.error(' - password');
      buildLogger.error();
      buildLogger.error('See https://github.com/namshi/roger#configuration');
      
      throw new Error('Fatality! MUAHAHUAAHUAH!');
    }
    
    /**
     * Ok, we can do better.
     * But it's 5.39 in the morning.
     */
    options.serveraddress = '127.0.0.1';
  }
  
  return options;
};

/**
 * Pushes an image to a registry.
 * 
 * @return promise
 */
docker.push = function(image, buildId, uuid, branch, registry, buildLogger) {
  var deferred  = Q.defer();
  
  image.push({tag: branch, force: true}, function(err, data){
    var somethingWentWrong = false;
    
    if (err) {
      deferred.reject(err);
    } else {
      data.on('error', function(err){
        deferred.reject(err);
      });
      
      data.on('data', function(out){
        var message = JSON.parse(out.toString('utf-8'));
        
        if (message.error) {
          deferred.reject(message)
          somethingWentWrong = true;
        }
        
        buildLogger.info("[%s] %s", buildId, message.status || message.error)
      });        
      
      data.on('end', function(){
        if (!somethingWentWrong) {
          buildLogger.info("[%s] Pushed image of build %s to the registry at http://%s", buildId, uuid, registry)
          deferred.resolve(); 
        }
      })
    }
  }, docker.getAuth(buildId, registry, buildLogger));
  return deferred.promise;
};

/**
 * Copies stuff from the container to
 * the host machine.
 */
docker.copy = function(container, containerPath, hostPath) {
  return Q.Promise(function(resolve, reject){
    container.copy({Resource: containerPath}, function(err, data){
      if (err) {
        reject(err);
        return;
      }
      
      return tar.createFromStream(hostPath, data).then(function(){
        resolve();
      });
    })
  });
}

module.exports = docker;