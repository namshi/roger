var config  =  require('./config')
var auth    = {};

/**
 * This is the base authorization function
 * that will be called before every route.
 *
 * By default, it just calls next, without
 * verifying that the user is authenticated.
 *
 * When you turn on authentication, this will
 * be overriden and will actually check that
 * the user is authenticated.
 *
 * @param  {object}   req
 * @param  {object}   res
 * @param  {Function} next
 * @return void
 */
auth.authorize = function(req, res, next){
  next()
}

/**
 * Enable authentication for the app.
 *
 * This method will dynamically load
 * a module provided by the user and
 * replace the authorize function so that
 * it will actually check that the user
 * is authenticated before letting it
 * hit routes in roger.
 *
 * @param  {[type]} app [description]
 * @return {[type]}     [description]
 */
auth.enable = function(app) {
  auth.authorize = function(req, res, next) {
    if (!req.isAuthenticated()) {
      throw new Error("You didnt say the magic word!")
    }

    next()
  };

  /**
   * This bit is what creates the magic: it loads
   * a module dynamically and lets you register your
   * own strategy based on passport
   * 
   * @see http://passportjs.org/docs/
   */
  require(config.get('app.auth.provider'))(app);
}

module.exports = auth;
