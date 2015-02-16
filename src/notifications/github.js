var github = require('./../github');

/**
 * Trigger a notification on github by
 * commenting on a PR with the build
 * status.
 */
module.exports = function(project, options, token) {
  options.logger.info('[%s] Notifying github of build %s', options.buildId, options.uuid)
  
  var parts       = project.from.split('/');
  options.repo    = parts.pop();
  options.user    = parts.pop();
  options.token   = token;
  options.comment = options.comments.join("\n\n");
  
  github.commentOnPullRequestByBranch(options);
};