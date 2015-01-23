var clone   = require("nodegit").Clone.clone;
var logger  = require("./logger");

var git = {}

/**
 * @return promise
 */
git.clone = function(repo, path, options) {
  logger.info('Cloning %s:%s in %s', repo, options.checkoutBranch, path);
  
  return clone(repo, path, options).then(function(repository){ 
    logger.info('Finished cloning %s:%s', repo, options.checkoutBranch);
    
    return repository;
  }).catch(function(err){
    logger.error(err.toString());
    throw err;
  })
}

module.exports = git;