var clone   = require("nodegit").Clone.clone;
var logger  = require("./logger");

var git = {}

/**
 * @return promise
 */
git.clone = function(repo, path, options) {
  logger.info('Cloning %s:%s', repo, options.checkoutBranch);
  
  return clone(repo, path, options).then(function(repository){ 
    logger.info('Finished cloning %s:%s', repo, options.checkoutBranch);
  }).catch(function(err){
    logger.error('Error cloning %s:%s (%s)', repo, options.checkoutBranch, err.toString());
  })
}

module.exports = git;