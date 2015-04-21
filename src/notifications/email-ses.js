var aws = require('aws-sdk');
var _ = require('lodash');

/**
 * Triggers an email notification
 * through AWS SES.
 */
module.exports = function(project, options, notificationOptions) {
  aws.config.accessKeyId      = notificationOptions['access-key'];
  aws.config.secretAccessKey  = notificationOptions.secret;
  aws.config.region           = notificationOptions.region;
  var ses                     = new aws.SES({apiVersion: '2010-12-01'});
  var recipients              = [];
  
  _.each(notificationOptions.to, function(recipient){
    if (recipient == 'committer' && options.author) {
      recipients.push(options.author)
    } else {
      recipients.push(recipient)
    }
  })

  ses.sendEmail( { 
    Source: notificationOptions.from, 
    Destination: { ToAddresses: recipients },
    Message: {
      Subject: {
        Data: options.comments.shift()
      },
      Body: {
        Text: {
          Data: options.comments.join("\n"),
        }
      }
    }
  }
  , function(err, data) {
      if(err) {
        options.logger.error(err);
        return;
      }

      options.logger.info('[%s] Sent email to %s', options.buildId, notificationOptions.to.join(','));
  });
}