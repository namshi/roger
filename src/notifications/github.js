var github = require('./../github');
var config = require('./../config');

/**
 * Creates a github status.
 */
module.exports = function(project, options) {
  options.logger.info('[%s] Creating github status for build %s', options.buildId, options.uuid);

  var parts       = project.repo.split('/');
  options.repo    = parts.pop();
  options.user    = parts.pop();
  options.token   = config.get('notifications.github.token');
  github.createStatus(options);
};
