var Q       = require('q');
var AWS     = require('aws-sdk');
var dir     = require('node-dir');
var path    = require('path');
var _       = require('lodash');
var docker  = require('./../docker');

/**
 * Upload a single file to S3.
 * 
 * @return readable stream
 */
function uploadToS3(options) {
  var s3 = require('s3');
   
  var client = s3.createClient({
    s3Options: {
      accessKeyId: options.key,
      secretAccessKey: options.secret,
    },
  });
  
  var params = {
    localFile: options.path,
   
    s3Params: {
      Bucket: options.bucket,
      Key: options.name || options.path,
    },
  };
  var uploader = client.uploadFile(params);
  
  return uploader;
}

/**
 * Uploads a whole directory to S3,
 * traversing its contents.
 * 
 * @return promise
 */
function uploadDirectoryToS3(options) {
  var uploads = [];
  
  return Q.Promise(function(resolve, reject){
    dir.files(options.dir, function(err, files){
      if (err) {
        throw err;
      }
      
      options.logger.info("[%s] Files to be uploaded to S3: \n%s", options.buildId, files.join("\n"));
      
      var count = 0;
      
      files.forEach(function(file){
        /**
         * Ghetto thing: remove the
         * first directory from the
         * file path.
         * 
         * If you want to archive the
         * contents of /a/b the tar library
         * we're using will create a tar
         * starting from the b directory.
         * Since we only want the contents
         * of b, without b itself, we strip
         * it out.
         */
        var f = path.relative(options.dir, file);
        f = f.split('/')
        f.shift();
        f = f.join('/')
        
        options.path = file;
        options.name = path.join(options.bucketPath || '', f);
        options.logger.info("[%s] Uploading %s in s3://%s/%s", options.buildId, file, options.bucket, options.name);
        
        uploads.push(Q.Promise(function(resolve, reject){
          count++;
          var upload = uploadToS3(options);
          
          upload.on('end', function(data) {
            count--;
            options.logger.info("[%s] %d remaining files to upload from %s", options.buildId, count, options.copy);
            resolve();
          });
          
          upload.on('error', function(err){
            reject(err);
          })
        }));
      })
      
      return Q.all(uploads).then(function(){
        resolve();
      }).catch(function(){
        reject()
      });
    })
  });
}

/**
 * Uploads to S3 after copying the desired stuff from
 * docker to the host machine.
 */
module.exports = function(dockerClient, buildId, project, logger, options){
  return Q.Promise(function(resolve, reject){
    var command = options.command || "sleep 1"; 
    console.info('Started publishing to S3');
    console.info(buildId);
    dockerClient.run(buildId, command.split(' '), process.stdout, function (err, data, container) {
      if (err) {
        reject(err);
      } else if (data.StatusCode === 0) {
        var artifactPath = path.join('/', 'tmp', buildId, 'publish', (new Date().getTime()).toString());
        
        docker.copy(container, options.copy, artifactPath).then(function(){
          logger.info("[%s] Copied %s outside of the container, in %s, preparing to upload it to S3", buildId, options.copy, artifactPath);
          var o = _.clone(options);
          o.buildId = buildId;
          o.dir     = path.join(artifactPath, options.copy);
          o.logger  = logger;
          
          uploadDirectoryToS3(o).then(function(){
            logger.info("[%s] All assets from %s uploaded to S3", buildId, options.copy);
            resolve()
          }).catch(function(err){
            reject(err)
          })
        }).catch(function(err){
          reject(err);
        });
      } else {
        reject(command + ' failed, exited with status code ' + data.StatusCode);
      }
    });
  });
};
