var fs      = require('fs')
var baseTar = require('tar-fs')
var logger  = require('./logger');
var Q       = require('q');

var tar = {};

/**
 * Creates a tarball at path with the contents
 * of the sourceDirectory.
 * 
 * After the tarball is created, the callback
 * gets invoked.
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