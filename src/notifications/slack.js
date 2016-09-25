var config = require('./../config');
var slack = require('slack-notify')(config.get('auth.slack.url'));

/**
 * Triggers a slack notification
 */

module.exports = function (project, options) {
  options.logger.info('[%s] Notifying slack of build %s', options.buildId, options.uuid);

  var parts       = project.repo.split('/');
  options.repo    = parts.pop();
  options.user    = parts.pop();

  if (options.result instanceof Error) {
    var color = '#d00000';
  } else {
    var color = '#36a64f';
  }

  slack.send({
    icon_emoji: config.get('notifications.slack.icon_emoji'),
    username: config.get('notifications.slack.username'),
    channel: config.get('notifications.slack.channel'),
    attachments: [{
      color: color,
      author_name: options.user,
      text: options.comments.join("\n\n")
      }]
    });
  };

slack.onError = function (err) {
  console.log('SLACK API error:', err);
};
