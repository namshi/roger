var passport  = require('/src/node_modules/passport');
var session  = require('/src/node_modules/express-session');

module.exports = function(app) {
  app.use(session({secret: '1234'}));
  app.use(passport.initialize());
  app.use(passport.session());

  var LocalStrategy = require('/src/node_modules/passport-local').Strategy;

  /**
   * Let's authenticate all users by default.
   */
  passport.use(new LocalStrategy(
    function(username, password, done) {
      done(null, {username: username, password: password});
    }
  ));

  /**
   * Define a route to authenticate your users,
   * then call next() to serve the response.
   */
  app.get('/login', passport.authenticate('local'), function(req, res, next){
    res.status(200).body = {result: "login successful"};
    next()
  });

  passport.serializeUser(function(user, done) {
    return done(null, JSON.stringify(user));
  });

  passport.deserializeUser(function(user, done) {
      return done(null, user);
  });
}
