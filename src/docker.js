var _       = require('lodash');
var moment  = require('moment');
var p       = require('path');
var Docker  = require('dockerode');
var Q       = require('q');
var git     = require('./git');
var config  = require('./config');
var logger  = require('./logger');
var tar     = require('./tar');
var hooks   = require('./hooks');
var client  = new Docker({socketPath: '/tmp/docker.sock'});
var docker  = {};

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

/**
 * Builds the specified branch of a project.
 * 
 * @return promise
 */
docker.build = function(project, branch, uuid) {
  var branch      = branch || 'master';
  var now         = moment();
  var timestamp   = Date.now() / 1000 | 0;
  var path        = '/tmp/roger-builds/sources/' + uuid;
  var imageId     = project.registry + '/' + project.name;
  var buildId     = imageId + ':' + branch;
  var tarPath     = '/tmp/roger-builds/' + uuid  + '.tar';
  var logFile     = '/tmp/roger-builds/' + uuid  + '.log';
  var buildLogger = getBuildLogger(logFile);
  
  buildLogger.info('[%s] Scheduled a build of %s', buildId, uuid);
  
  git.clone(project.from, path, branch, buildLogger).then(function(){
    var dockerfilePath = path;
    
    if (project.dockerfilePath) {
      dockerfilePath = p.join(path, project.dockerfilePath);
    }
    
    tar.create(tarPath,  dockerfilePath + '/').then(function(){
      buildLogger.info('[%s] Created tarball for %s', buildId, uuid);
      
      return docker.buildImage(project, tarPath, imageId, buildId, buildLogger); 
    }).then(function(){
      buildLogger.info('[%s] %s built succesfully', buildId, uuid);
      buildLogger.info('[%s] Tagging %s', buildId, uuid);
      
      return docker.tag(imageId, buildId, branch, buildLogger);
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
      buildLogger.info('[%s] Finished build %s in %s #SWAG', buildId, uuid, moment(now).fromNow(Boolean));
    }).catch(function(err){
      buildLogger.error('[%s] BUILD %s FAILED! ("%s") #YOLO', buildId, uuid, err.message || err.error);
    });
  });
  
  return {path: path, tar: tarPath, tag: buildId, log: logFile}
};

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
      buildLogger.info('Build of %s is in progress...', buildId);
      
      response.on('data', function(out){
        var result = JSON.parse(out.toString('utf-8'));
        
        if (result.progress) {
          result.status = result.status + ' ' + result.progress;
        }
        
        buildLogger.info("[%s] %s", buildId, result.stream || result.status);
      });
      
      response.on('error', function(err){
        deferred.reject(err);
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
  
  image.inspect(function(err, info){
    if (err) {
      deferred.reject(err);
    } else {
      buildLogger.info('Docker confirmed the build of %s, author %s, created on %s on docker %s', buildId, info.Author, info.Created, info.DockerVersion)
      buildLogger.info('Tagging %s', buildId);
      
      image.tag({repo: imageId, tag: branch}, function(){
        deferred.resolve(image);
      })
    }
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
  
  if (registry === config.get('auth.dockerhub.username')) {
    buildLogger.info('[%s] Image should be pushed to the DockerHub @ hub.docker.com', buildId);
    
    options = config.get('auth.dockerhub');
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
  
  image.push({tag: branch}, function(err, data){
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

module.exports = docker;