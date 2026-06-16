/**
 * Simple bearer-token auth. If ALLOWED_TOKEN is set in the environment,
 * every request must include `Authorization: Bearer <token>` matching it.
 * If ALLOWED_TOKEN is unset, auth is disabled (handy for local dev).
 */
module.exports = function requireToken(req, res, next) {
  const expected = process.env.ALLOWED_TOKEN;
  if (!expected) return next(); // auth disabled

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
