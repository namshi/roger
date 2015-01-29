var _             = require('lodash');
var github        = require('./github');
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
  
  var comment = 'Build ' + options.uuid + ' was successful';
  
  if (options.result instanceof Error) {
    comment = 'Build ' + options.uuid + ' broken: ' + options.result.message;
  }
  
  comment += "\nYou can check the build output at " + router.generate('build', {build: options.uuid});
  
  /**
   * Ghetto, as we like it.
   * 
   * Later on we need to support multiple notification
   * providers but for now this triconditional if (how fancy
   * I am) will do it.
   */
  if (_.isArray(project.notifications) && _.contains(project.notifications, 'github') && project['github-token']) {
    options.logger.info('[%s] Notifying github of build %s', options.buildId, options.uuid)
    
    var parts       = project.from.split('/');
    options.repo    = parts.pop();
    options.user    = parts.pop();
    options.token   = project['github-token'];
    options.branch  = branch;
    options.comment = comment;
    
    github.commentOnPullRequestByBranch(options);
  }
};

module.exports = notifications;