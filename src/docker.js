var _               = require('lodash');
var Docker          = require('dockerode');
var Q               = require('q');
var fs              = require('fs');
var config          = require('./config');
var tar             = require('./tar');
var docker          = {client: {}};
var path            = require('path');

var unixSocket = config.get('connect.socket') || '/tmp/docker.sock';
var tcpHost = require('netroute').getGateway();
var tcpPort = config.get('connect.tcp.port') || 2375;

if (config.get('connect.tcp.host') && config.get('connect.tcp.host') !== '__gateway__') {
  tcpHost = config.get('connect.tcp.host');
}

if (fs.existsSync(unixSocket) && !config.get('connect.tcp.force')) {
  docker.client = new Docker({socketPath: '/tmp/docker.sock'});
} else {
  docker.client = new Docker({host: tcpHost, port: tcpPort});
}

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
      buildLogger.info('Created container ' + uuid + ' for ' + builderId);
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

        try {
          var destinationPath = path.join(config.get('paths.tars'), project.name + '_' + uuid + '.tar');
          var destination = fs.createWriteStream(destinationPath);

          buildLogger.info('Fetching artifacts from ' + extractPath + ' and archiving  them to ' + destinationPath + '...');

          data.on('data', function() {
            buildLogger.info('Copying from ' + extractPath + ' to ' + destinationPath + '...');
          });

          data.on('end', function() {
            buildLogger.info(destinationPath + ' done!');
          });

          data.on('error', fail);
          destination.on('error', fail);

          destination.on('finish', function() {
            container.remove(function() {
              docker.buildImage(project, destinationPath, imageId, buildId, buildLogger, dockerOptions, uuid).then(resolve).catch(reject);
            });
          });

          data.pipe(destination);

        } catch(error) {
          fail(error);
        }
      });
    });
  });
}

/**
 * Builds a docker image.
 *
 * @return promise
 */
docker.buildImage = function(project, tarPath, imageId, buildId, buildLogger, dockerOptions, uuid) {
  return Q.promise(function(resolve, reject) {
    dockerOptions = dockerOptions || {};
    var tag = imageId + ((dockerOptions.dockerfile) ? '-builder' : '');

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
      });

      response.on('end', function() {
        if (dockerOptions.dockerfile) {
          extractAndRepackage(project, imageId, tag, buildId, buildLogger, dockerOptions, uuid).then(resolve);
          return;
        }

        resolve();
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
  var image     = docker.client.getImage(imageId);

  image.tag({repo: imageId, tag: branch}, function() {
    deferred.resolve(image);
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
docker.getAuth = function(buildId, registry, buildLogger) {
  var options = {};

  if (registry === 'dockerhub') {
    buildLogger.info('[%s] Image should be pushed to the DockerHub @ hub.docker.com', buildId);

    options = config.get('auth.dockerhub');

    if (!options || !options.username || !options.email || !options.password) {
      buildLogger.error('It seems that the build "%s" should be pushed to the dockerhub', buildId);
      buildLogger.error('but you forgot to add your credentials in the config file "%s"', argv.config);
      buildLogger.error();
      buildLogger.error('Please specify:');
      buildLogger.error(' - username');
      buildLogger.error(' - email address');
      buildLogger.error(' - password');
      buildLogger.error();
      buildLogger.error('See https://github.com/namshi/roger#configuration');

      throw new Error('Fatality! MUAHAHUAAHUAH!');
    }

    /**
     * Ok, we can do better.
     * But it's 5.39 in the morning.
     */
    options.serveraddress = '127.0.0.1';
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
  }, docker.getAuth(buildId, registry, buildLogger));

  return deferred.promise;
};

/**
 * Copies stuff from the container to
 * the host machine.
 */
docker.copy = function(container, containerPath, hostPath) {
  return Q.Promise(function(resolve, reject) {
    container.copy({Resource: containerPath}, function(err, data) {
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
