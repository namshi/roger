var fs      = require('fs')
var baseTar = require('tar-fs')
var logger  = require('./logger');
var Q       = require('q');

var tar = {};

/**
 * Creates a tarball from a readable stream,
 * at the given path.
 * 
 * @return promise
 */
tar.createFromStream = function(path, stream) {
  stream.pipe(baseTar.extract(path));
  
  return Q.Promise(function(resolve, reject){
    stream.on('error', function(err){
      reject(err);
    })
  
    stream.on('end', function(){
      resolve();
    });
  });
}

/**
 * Creates a tarball at path with the contents
 * of the sourceDirectory.
 * 
 * After the tarball is created, the callback
 * gets invoked.
 * 
 * @return promise
 */
tar.create = function(path, sourceDirectory, cb){
  var readable = fs.createWriteStream(path);
  var deferred = Q.defer();

  baseTar.pack(sourceDirectory).pipe(readable).on('error', function(err){
    deferred.reject(err);
  });

  readable.on('error', function(err){
    deferred.reject(err);
  })
  
  readable.on('finish', function(){
    deferred.resolve();
  });
  
  return deferred.promise;
};

module.exports = tar;