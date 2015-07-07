var _           = require('lodash');
var Q           = require('q');
var api         = require("github");
var config      = require('./config');
var logger      = require('./logger');
var github      = {};

/**
 * Retrieves a single pull
 * request.
 */
function getPullRequest(token, user, repo, number) {
  var deferred = Q.defer();
  var client = createClient(token);
  
  client.pullRequests.get({
    user: user,
    repo: repo,
    number: number
  }, function(err, pr){
    if (err) {
      deferred.reject(err);
      return;
    }
    
    deferred.resolve(pr)
  })
  
  return deferred.promise;
}

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
 * Creates an authenticated client for
 * the github API.
 */
function createClient(token) {
  var client = new api({version: '3.0.0'});
  
  client.authenticate({
    type: "oauth",
    token: token
  });
  
  return client;
}

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
  options.client = createClient(options.token);
  
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
 * Extract the projects referred
 * by this hook.
 * 
 * The project will be matched with the
 * repository URL in its configuration
 * (ie from: github/me/project)
 */
github.getProjectsFromHook = function(payload) {
  var projects = [];
  
  _.each(config.get('projects'), function(project){
    if (payload.repository && payload.repository.full_name && project.from.match(payload.repository.full_name)) {
      projects.push(project);
    }
  });
  
  return projects;
}

/**
 * Retrieves build information from
 * a github hook.
 * 
 * All you need to know is which repo /
 * branch this hook refers to.
 */
github.getBuildInfoFromHook = function(req) {
  var deferred = Q.defer();
  var payload  = req.body;
  var repo     = payload.repository && payload.repository.html_url
  var info     = {repo: repo}
  var githubToken = config.get('auth.github')
  
  if (repo) {
    if (req.headers['x-github-event'] === 'push') {
      info.branch  = payload.ref.replace('refs/heads/', '');
      deferred.resolve(info);
    } else if (req.headers['x-github-event'] === 'create' && payload.ref_type === 'tag') {
      info.branch = payload.ref
      deferred.resolve(info);
    } else if (req.headers['x-github-event'] === 'issue_comment' && githubToken && payload.issue.pull_request && payload.comment.body === 'build please!') {
      var user  = payload.repository.owner.login;
      var repo  = payload.repository.name;
      var nr    = payload.issue.pull_request.url.split('/').pop();
      
      getPullRequest(githubToken, user, repo, nr).then(function(pr){
        info.branch = pr.head.ref;
        deferred.resolve(info);
      }).catch(function(err){
        logger.error('Error while retrieving PR from github ("%s")', err.message);
        deferred.reject(err);
      });
    } else {
      deferred.reject('Could not obtain build info from the hook payload');
    }
  } else {
    deferred.reject('No project specified');
  }
  
  return deferred.promise;
};

module.exports = github;