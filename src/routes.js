var _       = require('lodash');
var uuid    = require('node-uuid')
var config  = require('./config');
var logger  = require('./logger');
var docker  = require('./docker');
var utils   = require('./utils');

var routes = {}

routes.build = function(req, res) {
  var body = res.body,
      status = 200,
      project = config.get('projects.' + req.params.project);
  
  if (!project) {
    body.error = 'invalid project';
    body.availableProjects = Object.keys(config.get('projects'));
    status = 400
  } else {
    var branch = req.params.branch || project.branch || 'master'
    var id     = uuid.v4();
    options    = docker.build(project, branch, id);
    body.result = 'build scheduled'
    body.build  = _.merge({
      project: project.name,
      branch: branch,
      id: id
    }, options);
    status = 202
  }
  
  res.status(status).send(body)
};

/**
 * Dumps the configuration object
 * in the response.
 */
function configMiddleware(req, res, next) {
  res.body = _.assign(res.body || {}, {config: utils.obfuscate(config.get())});
  
  next();
}

/**
 * Registers routes and middlewares
 * on the app.
 */
routes.bind = function(app) {
  app.use(configMiddleware);
  
  app.get('/api/builds/:project', routes.build);
  app.get('/api/builds/:project/:branch', routes.build);
  app.post('/api/builds/:project', routes.build);
  app.post('/api/builds/:project/:branch', routes.build);
};

module.exports = routes;