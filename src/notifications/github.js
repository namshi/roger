var github = require('./../github');
var config = require('./../config');

/**
 * Trigger a notification on github by
 * commenting on a PR with the build
 * status.
 */
module.exports = function(project, options) {
  options.logger.info('[%s] Notifying github of build %s', options.buildId, options.uuid)

  var parts       = project.repo.split('/');
  options.repo    = parts.pop();
  options.user    = parts.pop();
  options.token   = config.get('auth.github');
  options.comment = options.comments.join("\n\n");
  github.commentOnPullRequestByBranch(options);
};