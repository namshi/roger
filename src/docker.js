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
docker.build = function(project, branch) {
  var now       = moment();
  var timestamp = Date.now() / 1000 | 0;
  var path      = '/tmp/roger-builds/sources/' + project.name + '/' + timestamp;
  var imageId   = project.registry + '/' + project.name;
  var buildId   = imageId + ':' + branch;
  var tarPath   = '/tmp/roger-builds/' + project.name + '-' + timestamp  + '.tar';
  
  logger.info('Scheduled a build of %s', buildId);
  
  return git.clone(project.from, path, {checkoutBranch: branch}).then(function(){
    tar.create(tarPath, path + '/').then(function(){
      logger.info('created tarball for %s', buildId);
      
      return docker.buildImage(project, tarPath, imageId, buildId); 
    }).then(function(){
      logger.info('Image %s built succesfully', buildId);
      logger.info('Running after_build hooks for %s', buildId);
      
      return hooks.run('after_build', buildId, project, client);
    }).then(function(){
      logger.info('Ran after_build hooks for %s', buildId);
      
      return docker.tag(imageId, buildId, branch);
    }).then(function(image){
      logger.info('Pushing %s to %s', buildId, project.registry);
      
      return docker.push(image, buildId, branch, project.registry);
    }).then(function(){
      logger.info('Finished build of %s in %s #SWAG', buildId, moment(now).fromNow(Boolean));
    }).catch(function(err){
      logger.error('BUILD OF %s FAILED! ("%s") #YOLO', buildId, err.message);
    });
  });
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
 * Pushes an image to a registry.
 * 
 * @return promise
 */
docker.push = function(image, buildId, branch, registry) {
  var deferred  = Q.defer();
  
  image.push({registry: registry, tag: branch}, function(err, data){
    if (err) {
      deferred.reject(err);
    } else {
      data.on('error', function(err){
        deferred.reject(err);
      })
      
      data.on('data', function(out){
        logger.info("[%s] %s", buildId, JSON.parse(out.toString('utf-8')).status)
      })          
      
      data.on('end', function(){
        logger.info("Pushed image %s to the registry at http://%s", buildId, registry)
        deferred.resolve();
      })
    }
  });
  
  return deferred.promise;
};

module.exports = docker;