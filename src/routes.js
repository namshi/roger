var _       = require('lodash');
var uuid    = require('node-uuid')
var config  = require('./config');
var logger  = require('./logger');
var docker  = require('./docker');
var utils   = require('./utils');
var github  = require('./github');
var bodyParser = require('body-parser')

var routes = {}

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
    id: id
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
  var info = github.getBuildInfoFromHook(req);
  
  if (info) {
    var body    = {};  
    body.result = 'build scheduled'
    body.build  = scheduleBuild(info.project, info.branch);
    
    res.status(202).send(body);
    return;
  }
  
  res.status(400).send({error: 'unable to get build infos from this hook'});
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
  
  res.body._links = {};
  
  _.each(links, function(link, type){
    res.body._links[type] = {href: link};
  })
  
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
  
  app.get('/api/config', routes.config);
  app.get('/api/projects', routes.projects);
  app.post('/api/build-all', routes.buildAll);
  app.get('/api/projects/:project', routes.project);
  app.get('/api/projects/:project/build', routes.build);
  app.post('/api/projects/:project/build', routes.build);
  app.post('/hooks/github', routes.buildFromGithubHook);
  
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