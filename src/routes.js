var _       = require('lodash');
var config  = require('./config');
var logger  = require('./logger');
var docker  = require('./docker');

var routes = {}

routes.build = function(req, res) {
  var body = res.body,
      status = 200,
      project = req.query.project;
  
  if (!project) {
    body.error = 'you must specify a project, ie. /build?project=EXAMPLE';
    status = 400;
  } else {
    project = config.get('projects.' + project);
    
    if (!project) {
      body.error = 'invalid project';
      body.availableProjects = Object.keys(config.get('projects'));
      status = 400
    } else {
      docker.build(project, req.query.branch);
      body.result = 'build scheduled'
      status = 202
    }
  }
  
  res.status(status).send(body)
};

/**
 * Dumps the configuration object
 * in the response.
 */
function configMiddleware(req, res, next) {
  res.body = _.assign(res.body || {}, {config: config.get()});
  
  next();
}

/**
 * Registers routes and middlewares
 * on the app.
 */
routes.bind = function(app) {
  app.use(configMiddleware);
  
  app.get('/build', routes.build)
};

module.exports = routes;