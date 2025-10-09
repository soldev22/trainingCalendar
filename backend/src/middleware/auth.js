const jwt = require('jsonwebtoken');

function getTokenFromHeader(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  if (!h) return null;
  const parts = h.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

// Attaches req.user if token valid; does not error if missing/invalid
function maybeAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = { id: payload.sub, email: payload.email, role: payload.role };
  }
  next();
}

// Requires valid token; else 401
function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  req.user = { id: payload.sub, email: payload.email, role: payload.role };
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    next();
  });
}

module.exports = { maybeAuth, requireAuth, requireAdmin };
