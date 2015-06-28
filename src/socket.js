'use strict';
var fs          = require('fs');
var growingFile = require('growing-file');
var dispatcher  = require('./dispatcher');

module.exports = function (server) {
  var io = require('socket.io')(server);
  var ss = require('socket.io-stream');

  io.on('connection', function (socket) {
    console.log('websocket connected');

    /* For sending the build file*/
    ss(socket).on('get-build-log', function (stream, data) {
      var logFile = '/tmp/roger-builds/' + data.buildId + '.log';
      var growingStream = {};

      if (fs.existsSync(logFile)) {
        growingStream = growingFile.open(logFile, {timeout: 300000, interval: 1000});
        growingStream.pipe(stream);
        growingStream.on('end', function() {
          console.log('stream is closed');
        });
      }
    });

    /* When the projects db updated*/
    dispatcher.on('storage-updated', function() {
      socket.emit('fetch-data');
    });
  });
};