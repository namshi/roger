var url     = require('url');
var _       = require('lodash');
var config  = require('./config');
var utils   = {};

utils.path = function(to) {
  return config.get('paths.' + to);
}

/**
 * Utility function that takes an
 * object and recursively loops
 * through it replacing all "sensitive"
 * informations with *****.
 *
 * This is done to print out objects
 * without exposing passwords and so
 * on.
 */
utils.obfuscate = function(object) {
  object = _.clone(object);
  var stopWords = ['password', 'github', 'github-token', 'token', 'access-key', 'secret']

  _.each(object, function(value, key){
    if (typeof value === 'object') {
      object[key] = utils.obfuscate(value);
    }

    if (_.isString(value)) {
      object[key] = utils.obfuscateString(value);

      if (_.contains(stopWords, key)) {
        object[key] = '*****'
      }
    }
  })

  return object;
};

/**
 * Takes a string and remove all sensitive
 * values from it.
 *
 * For example, if the string is a URL, it
 * will remove the auth, if present.
 */
utils.obfuscateString = function(string) {
  var parts = url.parse(string);

  if (parts.host && parts.auth) {
    parts.auth = null;

    return url.format(parts);
  }

  return string;
}

module.exports = utils;
