var bodyParser  = require('body-parser')
var _           = require('lodash');
var fs          = require('fs');
var uuid        = require('node-uuid');
var growingFile = require('growing-file');
var config      = require('./config');
var storage     = require('./storage');
var logger      = require('./logger');
var docker      = require('./docker');
var utils       = require('./utils');
var github      = require('./github');
var storage     = require('./storage');
var router      = require('./router');
var routes      = {}

/**
 * Builds all configured projects.
 */
routes.build = function(req, res, next) {
  var repo = req.query.repo || req.body.repo
  var branch = req.query.branch || req.body.branch || "master"
  
  if (!repo) {
    res.status(400).body = {message: "You must specify a 'repo' parameter"};
    next();    
  }
  
  docker.schedule(repo, branch, uuid.v4())
  
  res.status(202).body = {message: "build scheduled"};
  next();
}

/**
 * List all builds
 */
routes.builds = function(req, res, next) {
  res.status(200).body = {builds: storage.getBuilds(req.query.limit)};
  next();
}

/**
 * List all projects
 */
routes.projects = function(req, res, next) {
  res.status(200).body = {projects: storage.getProjects(req.query.limit)};
  next();
}

/**
 * Shows the progressive status of the build
 * by keeping an eye on its log file.
 */
routes.buildStatus = function(req, res, next) {
  var logFile = '/tmp/roger-builds/' + req.params.build + '.log';
  
  if (fs.existsSync(logFile)) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
  
    growingFile.open(logFile, {timeout: 60000, interval: 1000}).pipe(res);
    return;
  }
  
  res.status(404);
  next();
};


/**
 * List configuration
 */
routes.config = function(req, res, next) {
  res.status(200).body = config.get();
  next();
};

/**
 * Trigger a build from a github hook.
 * 
 * Github will hit this URL and we will
 * extract from the hook the information
 * needed to schedule a build.
 */
routes.buildFromGithubHook = function(req, res) {
  github.getBuildInfoFromHook(req).then(function(info){
    docker.schedule(info.repo, info.branch || "master", uuid.v4())
    
    res.status(202).send({message: "builds triggered", info: info});
    return;
  }).catch(function(err){
    res.status(400).send({error: 'unable to get build infos from this hook'});
    logger.error(err)
  });
};

/**
 * Middleware that lets you specify
 * branches via colon in the URL
 * ie. redis:master.
 * 
 * If you don't want to specify a branch
 * simply omit it:
 * 
 * /api/projects/redis/build --> will build master
 * 
 * else use a colon:
 * 
 * /api/projects/redis:my-branch/build --> will build my-branch
 */
function repoMiddleware(req, res, next, repo){
  var parts = repo.split(':');
  
  if (parts.length === 2) {
    req.params.repo   = parts[0];
    req.params.branch = parts[1];
  }
  
  next();
};

/**
 * Hides sensitive values from the
 * response.body.
 */
function obfuscateMiddleware(req, res, next) {
  res.body = utils.obfuscate(res.body);
  next();
}


/**
 * 404 page: checks whether the reesponse
 * body is set, if not it assumes no one
 * could handle this request.
 */
function notFoundMiddleware(req, res, next){
  if (!res.body) {
    res.status(404).send({
      error: 'The page requested exists in your dreams',
      code: 404
    }); 
  }
  
  next();
}

/**
 * Registers routes and middlewares
 * on the app.
 */
routes.bind = function(app) {
  app.param('repo', repoMiddleware);
  app.use(bodyParser.json());
  
  app.get(router.generate('config'), routes.config);
  app.get(router.generate('builds'), routes.builds);
  app.get(router.generate('projects'), routes.projects);
  app.get(router.generate('build'), routes.buildStatus);
  app.get(router.generate('build-project'), routes.build);
  app.post(router.generate('build-project'), routes.build);
  app.post(router.generate('github-hooks'), routes.buildFromGithubHook);
  
  app.use(notFoundMiddleware);
  app.use(obfuscateMiddleware);
  
  /**
   * This middleare is actually used
   * to send the response to the
   * client.
   * 
   * Since we want to perform some 
   * transformations to the response,
   * like obfuscating it, we cannot
   * call res.send(...) directly in
   * the controllers.
   */
  app.use(function(req, res){
    res.send(res.body);
  })
};

module.exports = routes;