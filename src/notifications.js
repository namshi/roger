var _             = require('lodash');
var github        = require('./github');
var config        = require('./config');
var notifications = {};

/**
 * Trigger notifications for a specific project.
 */
notifications.trigger = function(project, branch, options){
  var comment = 'Build ' + options.uuid + ' was successful';
  
  if (options.result instanceof Error) {
    comment = 'Build ' + options.uuid + ' broken: ' + options.result.message;
  }
  
  comment += "\nYou can check the build output at " + config.get('app.url') + "/api/builds/" + options.uuid;
  
  /**
   * Ghetto, as we like it.
   * 
   * Later on we need to support multiple notification
   * providers but for now this triconditional if (how fancy
   * I am) will do it.
   */
  if (_.isArray(project.notifications) && _.contains(project.notifications, 'github') && project['github-token']) {
    options.logger.info('[%s] Notifying github of build %s', options.buildId, options.uuid)
    
    var parts     = project.from.split('/');
    var repo      = parts.pop();
    var user      = parts.pop();
    options.token = project['github-token'];
    
    github.commentOnPullRequestByBranch(user, repo, branch, comment, options);
  }
};

module.exports = notifications;