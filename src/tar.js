var fs      = require('fs')
var baseTar = require('tar-fs')
var logger  = require('./logger');

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

  baseTar.pack(sourceDirectory).pipe(readable).on('error', function(err){
    logger.error('error while creating tarball for %s, %s', path, err)
  });
  
  readable.on('finish', function(){
    cb && cb();
  });
};

module.exports = tar;