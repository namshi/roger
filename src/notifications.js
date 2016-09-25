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
  var comments = ['[' + options.project.name + ':' + branch + '] BUILD PASSED'];

  if (options.result instanceof Error) {
    comments = ['[' + options.project.name + ':' + branch + '] BUILD FAILED: ' + options.result.message];
  }

  comments.push("You can check the build output at " + router.generate('build-link', {build: options.uuid, projectName: project.name}, true));

  _.each(config.get('notifications'), function(val, key){
    if (val['global'] === 'true') {
      project.notify.push(key);
    }
  });

  if (_.isArray(project.notify)) {
    _.each(project.notify, function(handler){
      options.author    = options.author;
      options.branch    = branch;
      options.comments  = _.clone(comments);

      var notificationOptions = (project.notify && project.notify[handler]) || config.get('notifications.' + handler);

      try {
        require('./notifications/' + handler)(project, _.clone(options), notificationOptions);
      } catch(err) {
        options.logger.info('[%s] Error with notifying %s: %s', options.buildId, handler, err.toString());
      }
    });
  }
};

module.exports = notifications;
