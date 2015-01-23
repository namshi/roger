var Docker  = require('dockerode');
var git     = require('./git');
var config  = require('./config');
var logger  = require('./logger');
var tar     = require('./tar');
var client  = new Docker({socketPath: '/tmp/docker.sock'});
var docker  = {};

/**
 * Clones and builds the branch of the
 * project.
 * 
 * @return promise
 */
docker.build = function(project, branch) {
  branch        = branch || project.branch || 'master';
  var timestamp = Date.now() / 1000 | 0;
  var path      = '/tmp/roger-builds/sources/' + project.name + '/' + timestamp;
  var imageId   = project.to + '/' + project.name;
  var buildId   = imageId + ':' + branch;
  var tarPath   = '/tmp/roger-builds/' + project.name + '-' + timestamp  + '.tar';
  
  logger.info('Scheduled a build of %s', buildId);
  
  return git.clone(project.from, path, {checkoutBranch: branch}).then(function(repository){
    tar.create(tarPath, path + '/', function(){
      logger.info('created tarball for %s', buildId);
      
      client.buildImage(tarPath, {t: buildId}, function (err, response){
        if (err) {
          logger.error('error while sending tarball to the docker server for building %s,', buildId, err)
        } else {
          logger.info('Build of %s is in progress...', buildId);
          
          response.on('data', function(out){
            logger.info("[%s] %s", buildId, JSON.parse(out.toString('utf-8')).stream)
          });
          
          response.on('error', function(err){
            logger.error('error while building image %s,', buildId, err);
          });
          
          response.on('end', function(){
            logger.info('Image %s built succesfully', buildId);
            
            var image = client.getImage(imageId);
            
            image.inspect(function(err, info){
              if (err) {
                logger.error('error retrieving informations for image %s,', buildId, err);
              } else {
                logger.info('Docker confirmed the build of %s, author %s, created on %s on docker %s', buildId, info.Author, info.Created, info.DockerVersion)
                logger.info('Pushing %s to %s', buildId, project.to);

                image.push({registry: project.to, tag: branch}, function(err, data){
                  if (err) {
                    logger.error('Error pushing %s,', buildId, err);
                  } else {
                    data.on('error', function(err){
                      logger.error('Error while pushing %s,', buildId, err);
                    })
                    
                    data.on('data', function(out){
                      logger.info("[%s] %s", buildId, JSON.parse(out.toString('utf-8')).status)
                    })          
                    
                    data.on('end', function(){
                      logger.info("Pushed image %s to the registry at http://%s", buildId, project.to)
                    })
                  }
                });
              }
            })
          });
        }
      });      
    });
  });
};

module.exports = docker;