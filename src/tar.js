var Q       = require('q');
var spawn   = require('child_process').spawn;

var tar = {};

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
  var deferred = Q.defer();
  var tar = spawn('tar', ['-C', sourceDirectory, '-czvf', path, '.']);

  tar.stderr.on('data', function(data) {
    deferred.reject(data)
  });

  tar.on('close', function(code) {
    if (code === 0) {
      deferred.resolve()
    } else {
      deferred.reject(new Error("Unable to tar -- exit code " + code))
    }
  });

  return deferred.promise;
};

module.exports = tar;
