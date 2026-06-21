// Passport configuration (local strategy + session serialization) 

import passport from "passport";
import LocalStrategy from "passport-local";
import { getUserByCredentials, getUserById } from "./dao-users.js";

// Verify username/password against the DB
passport.use(
  new LocalStrategy(async function verify(username, password, callback) {
    const user = await getUserByCredentials(username, password);
    if (!user) return callback(null, false, "Incorrect username or password");
    return callback(null, user); // {id, username} stored in the session
  })
);

// Store the whole (small) user object in the session
passport.serializeUser((user, callback) => {
  callback(null, user);
});

// Rebuild the current user from the session on each request (re-fetched from the DB)
passport.deserializeUser((user, callback) => {
  getUserById(user.id)
    .then((u) => callback(null, u))
    .catch((err) => callback(err, null));
});

// Middleware that protects routes requiring an authenticated user
export const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authorized" });
};

export default passport;
