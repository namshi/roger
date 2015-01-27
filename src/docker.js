var moment  = require('moment');
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
 * Builds the specified branch of a project.
 * 
 * @return promise
 */
docker.build = function(project, branch, uuid) {
  var branch    = branch || 'master';
  var now       = moment();
  var timestamp = Date.now() / 1000 | 0;
  var path      = '/tmp/roger-builds/sources/' + uuid;
  var imageId   = project.registry + '/' + project.name;
  var buildId   = imageId + ':' + branch;
  var tarPath   = '/tmp/roger-builds/' + uuid  + '.tar';
  
  logger.info('[%s] Scheduled a build of %s', buildId, uuid);
  
  git.clone(project.from, path, branch).then(function(){
    tar.create(tarPath, path + '/').then(function(){
      logger.info('[%s] Created tarball for %s', buildId, uuid);
      
      return docker.buildImage(project, tarPath, imageId, buildId); 
    }).then(function(){
      logger.info('[%s] %s built succesfully', buildId, uuid);
      logger.info('[%s] Tagging %s', buildId, uuid);
      
      return docker.tag(imageId, buildId, branch);
    }).then(function(image){
      logger.info('[%s] Running after-build hooks for %s', buildId, uuid);
      
      return hooks.run('after-build', buildId, project, client).then(function(){
        return image;
      });
    }).then(function(image){
      logger.info('[%s] Ran after-build hooks for %s', buildId, uuid);
      logger.info('[%s] Pushing %s to %s', buildId, uuid, project.registry);
      
      return docker.push(image, buildId, uuid, branch, project.registry);
    }).then(function(){
      logger.info('[%s] Finished build %s in %s #SWAG', buildId, uuid, moment(now).fromNow(Boolean));
    }).catch(function(err){
      logger.error('[%s] BUILD %s FAILED! ("%s") #YOLO', buildId, uuid, err.message || err.error);
    });
  });
  
  return {path: path, tar: tarPath, tag: buildId}
};

/**
 * Builds a docker image.
 * 
 * @return promise
 */
docker.buildImage = function(project, tarPath, imageId, buildId) {
  var deferred = Q.defer();
  
  client.buildImage(tarPath, {t: imageId}, function (err, response){
    if (err) {
      deferred.reject(err);
    } else {
      logger.info('Build of %s is in progress...', buildId);
      
      response.on('data', function(out){
        var result = JSON.parse(out.toString('utf-8'));
        
        if (result.progress) {
          result.status = result.status + ' ' + result.progress;
        }
        
        logger.info("[%s] %s", buildId, result.stream || result.status);
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
docker.tag = function(imageId, buildId, branch) {
  var deferred  = Q.defer();
  var image     = client.getImage(imageId);
  
  image.inspect(function(err, info){
    if (err) {
      deferred.reject(err);
    } else {
      logger.info('Docker confirmed the build of %s, author %s, created on %s on docker %s', buildId, info.Author, info.Created, info.DockerVersion)
      logger.info('Tagging %s', buildId);
      
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
docker.getAuth = function(buildId, registry) {
  var options = {};
  
  if (registry === config.get('auth.dockerhub.username')) {
    logger.info('[%s] Image should be pushed to the DockerHub @ hub.docker.com', buildId);
    
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
docker.push = function(image, buildId, uuid, branch, registry) {
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
        
        logger.info("[%s] %s", buildId, message.status || message.error)
      });        
      
      data.on('end', function(){
        if (!somethingWentWrong) {
          logger.info("[%s] Pushed image of build %s to the registry at http://%s", buildId, uuid, registry)
          deferred.resolve(); 
        }
      })
    }
  }, docker.getAuth(buildId, registry));
  
  return deferred.promise;
};

module.exports = docker;