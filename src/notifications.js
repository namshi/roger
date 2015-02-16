var _             = require('lodash');
var config        = require('./config');
var router        = require('./router');
var notifications = {};

/**
 * Trigger notifications for a specific project.
 * 
 * @param project
 * @param branch
 * @param options {buildId, uuid, logger}
 */
notifications.trigger = function(project, branch, options){
  options.logger.info('[%s] Sending notifications for %s', options.buildId, options.uuid);
  var comments = ['Build ' + options.uuid + ' was successful'];
  
  if (options.result instanceof Error) {
    comments = ['Build ' + options.uuid + ' broken: ' + options.result.message];
  }
  
  comments.push("You can check the build output at " + router.generate('build', {build: options.uuid}, true));
  
  if (_.isObject(project.notifications)) {
    options.branch    = branch;
    options.comments  = comments;

    _.each(project.notify, function(handler){
      var notificationOptions = (project.notifications && project.notifications[handler]) || config.get('notifications.' + handler);
      
      require('./notifications/' + handler)(project, _.clone(options), notificationOptions);
    })
  }
};

module.exports = notifications;