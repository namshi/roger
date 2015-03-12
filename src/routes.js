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
var router      = require('./router');
var routes      = {}

/**
 * Schedules a build and returns
 * information about it, like it's
 * build ID, while we keep it running
 * in background.
 * 
 * @return object
 */
function scheduleBuild(project, branch) {
  var id   = uuid.v4();
  var info = docker.build(project, branch, id);
  
  return _.merge({
    project: project.name,
    branch: project.branch,
    id: id,
    status: '/api/builds/' + id
  }, info);
};

/**
 * Builds all configured projects.
 */
routes.buildAll = function(req, res, next) {
  var body = {builds: []};
  
  _.each(config.get('projects'), function(project){
    body.builds.push(scheduleBuild(project, project.branch));
  });
  
  res.status(202).body = body;
  next();
}

/**
 * Triggers a build of a project.
 */
routes.build = function(req, res, next) {
  var body = res.body || {},
      status = 200,
      project = config.get('projects.' + req.params.project);

  if (!project) {
    body.error = 'invalid project';
    body.project = project;
    body.availableProjects = Object.keys(config.get('projects'));
    status = 400
  } else {
    body.result = 'build scheduled';
    body.build  = scheduleBuild(project, req.params.branch || project.branch);
    status      = 202;
    
    if (req.query.r) {
      status = 302;
      res.setHeader('Location', body.build.status)
    }
  }
  
  res.status(status).body = body;
  next();
};

/**
 * Shows a project's configuration
 */
routes.project = function(req, res, next) {
  var project = config.get('projects.' + req.params.project),
      status  = 200,
      body    = {};
  
  if (!project) {
    body.error = 'invalid project';
    body.availableProjects = Object.keys(config.get('projects'));
    status = 400
  } else {
    body = project;
  }
  
  res.status(status).body = body;
  next();
};

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
 * List projects
 */
routes.projects = function(req, res, next) {
  res.status(200).body = config.get('projects');
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
    var body    = {};  
    body.result = 'build scheduled'
    body.builds  = [];
    
    _.each(info.projects, function(project){
      body.builds.push(scheduleBuild(project, info.branch));
    });
    
    res.status(202).send(body);
    return;
  }).catch(function(){
    res.status(400).send({error: 'unable to get build infos from this hook'});
  });
};

/**
 * Returns all builds of a particular
 * project.
 */
routes.buildsByProject = function(req, res, next) {
  res.body = {
    builds: storage.getBuildsByProject(req.params.project)
  };
  
  res.status(200);
  next();
};

/**
 * Returns a specific build.
 */
routes.buildByProject = function(req, res, next) {
  var build = storage.getBuildByProject(req.params.id, req.params.project);

  if (build) {
    res.body = {
      build: build
    };
    
    res.status(200);
  } else {
    res.status(404);
  }
  
  next();
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
function projectNameMiddleware(req, res, next, project){
  var parts = project.split(':');
  res.locals.requestedProject = project;
  
  if (parts.length === 2) {
    req.params.project  = parts[0];
    req.params.branch   = parts[1];
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
 * Add some links to the response.
 */
function linksEmbedderMiddleare(req, res, next) {
  var links = {
    config:   '/api/config',
    buildAll: '/api/build-all',
    projects: '/api/projects',
    self:     req.url,
  }
  
  if (res.locals.requestedProject) {
    links.project = '/api/config/' + res.locals.requestedProject.split(':')[0],
    links.build   = '/api/projects/' + res.locals.requestedProject + '/build'
  }
  
  if (res.body) {
    res.body._links = {};
    
    _.each(links, function(link, type){
      res.body._links[type] = {href: link};
    })
  }
  
  next();
};

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
  app.param('project', projectNameMiddleware);
  app.use(bodyParser.json());
  
  app.get(router.generate('config'), routes.config);
  app.get(router.generate('projects'), routes.projects);
  app.post(router.generate('build-all'), routes.buildAll);
  app.get(router.generate('project'), routes.project);
  app.get(router.generate('build-project'), routes.build);
  app.post(router.generate('build-project'), routes.build);
  app.get(router.generate('build'), routes.buildStatus);
  app.get(router.generate('buildsByProject'), routes.buildsByProject);
  app.get(router.generate('buildByProject'), routes.buildByProject);
  app.post(router.generate('github-hooks'), routes.buildFromGithubHook);
  
  app.use(notFoundMiddleware);
  app.use(obfuscateMiddleware);
  app.use(linksEmbedderMiddleare);
  
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