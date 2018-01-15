var Q       = require('q');
var spawn   = require('child_process').spawn;
var baseTar = require('tar-fs')

var tar = {};

tar.createFromStream = function(path, stream) {
  var extract = baseTar.extract(path, {strict: false});
  stream.pipe(extract);

  return Q.Promise(function(resolve, reject){
    stream.on('error', function(err){
      reject(err);
    })

    extract.on('finish', function() {
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
tar.create = function(path, sourceDirectory, buildLogger, buildOptions){
  var deferred = Q.defer();
  var tar = spawn('tar', ['-C', sourceDirectory, '-czvf', path, '.']);

  buildLogger.info('[%s] Creating tarball', buildOptions.buildId);

  tar.stderr.on('data', function(data) {
    buildLogger.error('[%s] Error creating tarball', buildOptions.buildId);
    deferred.reject(data)
  });

  tar.stdout.on('data', function(data) {
    buildLogger.error('[%s] %s', buildOptions.buildId, data.toString());
  });

  tar.on('close', function(code) {
    if (code === 0) {
      buildLogger.info('[%s] Tarball created', buildOptions.buildId);
      deferred.resolve()
    } else {
      buildLogger.info('[%s] Error creating tarball', buildOptions.buildId);
      deferred.reject(new Error("Unable to tar -- exit code " + code))
    }
  });

  return deferred.promise;
};

module.exports = tar;
