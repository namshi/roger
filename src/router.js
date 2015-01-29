var config = require('./config');
var router = {};

/**
 * Generates a URL with the given options.
 */
router.generate = function(route, options, absolute) {
  return (absolute ? config.get('app.url') : '') + config.get('routes.' + route, options);
};

module.exports = router;