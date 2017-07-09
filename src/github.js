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
 * Create status
 * 
 * @param options {owner, repo, sha, state, comment, logger}
 */
github.createStatus = function(options) {
  var client = createClient(options.token);

  client.repos.createStatus({
    owner: options.user,
    repo: options.repo,
    sha: options.sha,
    state: options.status.state,
    target_url: options.status.target_url,
    description: options.status.description,
    context: "continuous-integration/roger",
  }, function(err, res){
    if (err) {
      options.logger.error(err);
      return;
    }
    options.logger.info('[%s] Created github status for build %s', options.buildId, options.uuid);
    return;
  });
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
