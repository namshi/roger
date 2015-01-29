var aws = require('aws-sdk');

/**
 * Triggers an email notification
 * through AWS SES.
 */
module.exports = function(project, options, notificationOptions) {
  aws.config.accessKeyId      = notificationOptions['access-key'];
  aws.config.secretAccessKey  = notificationOptions.secret;
  aws.config.region           = notificationOptions.region;
  
  var ses   = new aws.SES({apiVersion: '2010-12-01'});

  ses.sendEmail( { 
    Source: notificationOptions.from, 
    Destination: { ToAddresses: notificationOptions.to },
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