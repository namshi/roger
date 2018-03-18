var _               = require('lodash');
var Docker          = require('dockerode');
var Q               = require('q');
var fs              = require('fs');
var config          = require('./config');
var tar             = require('./tar');
var docker          = {client: {}};
var path            = require('path');

if (config.get('docker.client.host') === '__gateway__') {
  config.config.docker.client.host = require('netroute').getGateway()
}

docker.client = new Docker(config.get('docker.client'));

function extractAndRepackage(project, imageId, builderId, buildId, buildLogger, dockerOptions, uuid) {
  return Q.Promise(function(resolve, reject) {
    delete dockerOptions.dockerfile;
    var extractPath = project.build.extract;
    extractPath += (extractPath[extractPath.length] === '/') ? '.'  : '/.';
    buildLogger.info('Boldly extracting produced stuff form: ', extractPath);

    docker.client.createContainer({Image: builderId, name: uuid, Cmd: ['/bin/sh']}, function (err, container) {
      if (err) {
        reject(err);
        return;
      }

      container.getArchive({path: extractPath}, function(error, data) {
        var failed = false;
        if (error) {
          reject(error);
          return;
        }

        function fail(error) {
          if (!failed) {
              container.remove(function() {
              failed = true;
              reject(error);
            });
          }
        }

        var srcPath = path.join(config.get('paths.tars'), project.name + '_' + uuid + '.tar');
        var destination = fs.createWriteStream(srcPath);
        data.on('data', function() {
          process.stdout.write('•');
        });

        data.on('end', function() {
          process.stdout.write('\n');
        });

        data.on('error', fail);
        destination.on('error', fail);

        destination.on('finish', function() {
          container.remove(function() {
            docker.buildImage(project, srcPath, imageId, buildId, buildLogger, dockerOptions, uuid).then(resolve).catch(reject);
          });
        });

        data.pipe(destination);
      });
    });
  });
}

docker.pullImage = function pullImage(buildId, from, imageId, dockerOptions, buildLogger) {
  return Q.promise(function(resolve, reject) {
    let opts = {
      authconfig: docker.getAuth(buildId, buildLogger)
    };

    let tag = imageId + ((dockerOptions.dockerfile) ? '-builder' : '');

    if (from === "scratch") {
      return resolve();
    }

    buildLogger.info('[%s] pull image %s', buildId, from);

    docker.client.pull(from, opts, function (err, stream) {
      if (err) {
        return reject(err)
      }

      stream.on('data', function(out) {
        let result = {};

        try {
          result = JSON.parse(out.toString('utf-8'));
        } catch (err) {
          buildLogger.error('[%s] %s', tag, err);
        }

        if (result.error) {
          buildLogger.error('[%s] %s', tag, result.error);
          reject(result.error);
          return;
        }

        if (result.progress) {
          result.status = result.status + ' ' + result.progress;
        }

        buildLogger.info('[%s] %s', tag, result.stream || result.status);
      });


      stream.on('end', function(err) {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  })

};

docker.extractFromImageName = function extractFromImageName(dockerFile) {
  return Q.promise(function (resolve, reject) {
    let from;

    fs.readFile(dockerFile, function (err, data) {
      if (err) {
        return reject(err)
      }

      data.toString().split('\n').forEach(function (line) {
        let match = line.match(/^FROM +(.*)$/);
        if (match) {
          from = match[1]
        }
      });

      if (!from) {
        reject('FROM keyword not found.');
      }

      resolve(from);
    });

  });
};

/**
 * Builds a docker image.
 *
 * @return promise
 */
docker.buildImage = function(project, tarPath, imageId, buildId, buildLogger, dockerOptions, uuid) {
  return Q.promise(function(resolve, reject) {
    dockerOptions = dockerOptions || {};
    var tag = imageId + ((dockerOptions.dockerfile) ? '-builder' : '');
    var realBuildId = buildId;

    docker.client.buildImage(tarPath, _.extend({t: tag}, dockerOptions), function(err, response) {
      if (err) {
        reject(err);
        return;
      }

      buildLogger.info('[%s] Build is in progress...', tag);

      response.on('data', function(out) {
        var result = {};

        try {
          result = JSON.parse(out.toString('utf-8'));
        } catch (err) {
          buildLogger.error('[%s] %s', tag, err);
        }

        if (result.error) {
          buildLogger.error('[%s] %s', tag, result.error);
          reject(result.error);
          return;
        }

        if (result.progress) {
          result.status = result.status + ' ' + result.progress;
        }

        buildLogger.info('[%s] %s', tag, result.stream || result.status);
        if (result.stream && result.stream.indexOf('Successfully built ') == 0) {
          realBuildId = result.stream.split('Successfully built ')[1].replace('\n', '');
        }
      });

      response.on('end', function() {
        if (dockerOptions.dockerfile) {
          extractAndRepackage(project, imageId, tag, buildId, buildLogger, dockerOptions, uuid).then(resolve).catch(function(err){
            buildLogger.error('[%s] %s', tag, err.message);
          });
          return;
        }

        resolve(realBuildId);
      });
    });
  });
};

/**
 * Tags "branch" off the latest imageId.
 *
 * @return promise
 */
docker.tag = function(imageId, buildId, branch) {
  var deferred  = Q.defer();
  var image     = docker.client.getImage(imageId + ':' + branch);

  image.tag({repo: imageId, tag: branch}, function() {
    deferred.resolve(docker.client.getImage(imageId));
  });

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
docker.getAuth = function(buildId, buildLogger) {
  let options = config.get('auth.registry', {}, {});

  if (options.length > 0) {
    buildLogger.info('[%s] Image should be pushed to the DockerHub @ hub.docker.com', buildId);

    options.serveraddress = options.address || '127.0.0.1';

    if (!options || !options.username || !options.password) {
      buildLogger.error('It seems that the build "%s" should be pushed to a private registry', buildId);
      buildLogger.error('but you forgot to add your credentials in the config file');
      buildLogger.error();
      buildLogger.error('Please specify:');
      buildLogger.error(' - username');
      buildLogger.error(' - password');
      buildLogger.error();
      buildLogger.error('See https://github.com/namshi/roger#configuration');

      throw new Error('Fatality! MUAHAHUAAHUAH!');
    }
  }

  return options;
};

/**
 * Pushes an image to a registry.
 *
 * @return promise
 */
docker.push = function(image, buildId, uuid, branch, registry, buildLogger) {
  var deferred  = Q.defer();

  image.push({tag: branch, force: true}, function(err, data) {
    var somethingWentWrong = false;

    if (err) {
      deferred.reject(err);
    } else {
      data.on('error', function(err) {
        deferred.reject(err);
      });

      data.on('data', function(out) {
        var message = {};

        try {
          message = JSON.parse(out.toString('utf-8'));
        } catch (err) {
          buildLogger.error("[%s] %s", buildId, err);
        }


        if (message.error) {
          deferred.reject(message);
          somethingWentWrong = true;
        }

        buildLogger.info('[%s] %s', buildId, message.status || message.error);
      });

      data.on('end', function() {
        if (!somethingWentWrong) {
          buildLogger.info('[%s] Pushed image of build %s to the registry at http://%s', buildId, uuid, registry);
          deferred.resolve();
        }
      });
    }
  }, docker.getAuth(buildId, buildLogger));

  return deferred.promise;
};

/**
 * Copies stuff from the container to
 * the host machine.
 */
docker.copy = function(container, containerPath, hostPath) {
  return Q.Promise(function(resolve, reject) {
    container.export(function(err, data) {
      if (err) {
        reject(err);
        return;
      }

      return tar.createFromStream(hostPath, data).then(function() {
        resolve();
      });
    });
  });
};

module.exports = docker;
