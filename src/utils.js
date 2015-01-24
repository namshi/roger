var _     = require('lodash');
var utils = {};

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
  var stopWords = ['password', 'github', 'github-token']
  
  _.each(object, function(value, key){
    if (typeof value === 'object') {
      object[key] = utils.obfuscate(value);
    }
    
    if (_.isString(value) && _.contains(stopWords, key)) {
      object[key] = '*****'
    }
  })
  
  return object;  
};

module.exports = utils;