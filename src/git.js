var Q       = require('q');
var spawn   = require('child_process').spawn;
var utils   = require("./utils");
var Git     = require("nodegit");
var git     = {};

/**
 * Get a nodegit commit object from a reference name
 * @param  {string} path - The path to the Git repository
 * @param  {string} name - The name of the reference to get
 * @return {promise}     - A promise that resolves to the commit
 */
git.getCommit = function(path, name) {
  return Git.Repository.open(path)
    .then(function(repo) {
      // Look up the branch or tag by its name
      return Git.Reference.dwim(repo, name)
        .then(function(ref) {
          // Convert tags to commit objects
          return ref.peel(Git.Object.TYPE.COMMIT)
        })
        .then(function(ref) {
          // Get the commit object from the repo
          return Git.Commit.lookup(repo, ref.id())
        })
  });
}

/**
 * Clones the repository at the specified path,
 * only fetching a specific branch -- which is
 * the one we want to build.
 *
 * @return promise
 */
git.clone = function(repo, path, branch, logger) {
  logger.info('Cloning %s:%s in %s', utils.obfuscateString(repo), branch, path);
  var deferred = Q.defer();
  var clone    = spawn('git', ['clone', '-b', branch, '--single-branch', '--depth', '1', repo, path]);

  clone.stdout.on('data', function (data) {
    logger.info('git clone %s: %s', utils.obfuscateString(repo), data.toString());
  });

  /**
   * Git gotcha, the output of a 'git clone'
   * is sent to stderr rather than stdout
   *
   * @see http://git.661346.n2.nabble.com/Bugreport-Git-responds-with-stderr-instead-of-stdout-td4959280.html
   */
  clone.stderr.on('data', function (err) {
    logger.info('git clone %s: %s', utils.obfuscateString(repo), err.toString());
  });

  clone.on('close', function (code) {
    if (code === 0) {
      logger.info('git clone %s: finished cloning', utils.obfuscateString(repo));
      deferred.resolve();
    } else {
      deferred.reject('child process exited with status ' + code);
    }
  });

  return deferred.promise;
}

module.exports = git;
