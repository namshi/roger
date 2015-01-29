var _           = require('lodash');
var Q           = require('q');
var api         = require("github");
var config      = require('./config');
var github      = {};

/**
 * Returns all open pull requests for a
 * given repo.
 * 
 * @param options {user, repo}
 */
function getAllPullRequests(options) {
  var deferred = Q.defer();
  
  options.client.pullRequests.getAll({
    user: options.user,
    repo: options.repo,
    state: 'open'
  }, function(err, pulls){
    if (err) {
      deferred.reject(err);
      
      return;
    }
    
    deferred.resolve(pulls);
  })
  
  return deferred.promise;
};

/**
 * Comments on a PR.
 * 
 * @param options {pr, buildId, uuid, user, repo, comment, logger}
 */
function commentOnPullRequest(options) {
  var deferred = Q.defer();
  
  options.client.issues.createComment({
    user: options.user,
    repo: options.repo,
    number: options.pr.issue_url.split('/').pop(),
    body: options.comment
  }, function(err, data){
    if (err) {
      promise.reject(err);
      
      return;
    } else {
      deferred.resolve();
    }
  });
  
  return deferred.promise;
};

/**
 * Comments on a pull request opened from
 * the given branch.
 * 
 * If multiple PRs are open from the same
 * branch, multiple comments are posted.
 * 
 * @param options {branch, comment, buildId, uuid, token, comment, logger, token}
 */
github.commentOnPullRequestByBranch = function(options) {
  var client = new api({version: '3.0.0'});
  
  client.authenticate({
    type: "oauth",
    token: options.token
  });
  
  options.client = client;
  
  getAllPullRequests(options).then(function(pulls){
    _.each(pulls, function(pr){
      if (pr.head.ref === options.branch) {
        options.pr = pr;
        
        commentOnPullRequest(options).then(function(){
          options.logger.info('[%s] Commented on PR %s', options.buildId, pr.html_url);
        });
      }
    })
  }).catch(function(err){
    options.logger.error(err);
  });
};

/**
 * Extract the project that is referred
 * by this hook.
 * 
 * The project will be matched with the
 * repository URL in its configuration
 * (ie from: github/me/project)
 */
github.getProjectFromHook = function(payload) {
  var project;
  
  _.each(config.get('projects'), function(p){
    if (payload.repository && payload.repository.full_name && p.from.match(payload.repository.full_name)) {
      project = p;
    }
  });
  
  return project;
}

/**
 * Retrieves build information from
 * a github hook.
 * 
 * All you need to know is which project
 * this hook refers to and the branch / tag
 * we need to build.
 */
github.getBuildInfoFromHook = function(req) {
  var payload  = req.body;
  var project  = github.getProjectFromHook(payload);
  var info     = {};
  
  if (project) {
    info.project  = project;
    
    if (req.headers['x-github-event'] === 'push') {
      info.branch  = payload.ref.replace('refs/heads/', '');
    } else if (req.headers['x-github-event'] === 'create' && payload.ref_type === 'tag') {
      info.branch = payload.ref
    } else {
      return;
    }
    
    return info;
  }
};

module.exports = github;