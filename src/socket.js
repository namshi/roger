'use strict';
var fs          = require('fs');
var path        = require('path');
var growingFile = require('growing-file');
var dispatcher  = require('./dispatcher');
var utils       = require('./utils');
var config      = require('./config');

module.exports = function (server) {
  var io = require('socket.io')(server);
  var ss = require('socket.io-stream');

  io.on('connection', function (socket) {
    console.log('websocket connected');

   io.origins((origin, callback) => {
        if (origin !== config.get('app.url') + '/') {
            return callback('origin not allowed', false);
        }
      callback(null, true);
    });

    /* When the projects db updated*/
    dispatcher.on('storage-updated', function() {
      socket.emit('fetch-data');
    });
  });
};
