var _       = require('lodash');
var config  = require('./config');
var github  = {};

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