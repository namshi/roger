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
  var tarPath   = '/tmp/roger-builds/' + id + '-' + timestamp  + '.tar';
  var id        = project.name + ':' + branch;
  
  logger.info('Scheduled a build of %s', id);
  
  return git.clone(project.from, path, {checkoutBranch: branch}).then(function(repository){
    tar.create(tarPath, path + '/', function(){
      logger.info('created tarball for %s', id);
      
      client.buildImage(tarPath, {t: id}, function (err, response){
        if (err) {
          logger.error('error while sending tarball to the docker server for building %s,', id, err)
        } else {
          logger.info('Build of %s is in progress...', id);
          
          response.on('data', function(out){
            logger.info(JSON.parse(out.toString('utf-8')).stream)
          });
          
          response.on('error', function(err){
            logger.error('error while building image %s,', id, err);
          });
          
          response.on('end', function(){
            logger.error('Image %s built succesfully', id);
          });
        }
      });      
    });
  });
};

module.exports = docker;