var winston = require('winston');

/**
 * #dafuq
 */
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {timestamp: true});

module.exports = winston;
