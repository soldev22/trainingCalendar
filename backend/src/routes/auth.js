const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, secret, { expiresIn: '7d' });
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ ok: false, error: 'email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });
    const token = signToken(user);
    return res.status(201).json({ ok: true, token, user: { id: user._id, email: user.email } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ ok: false, error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid credentials' });
    const token = signToken(user);
    return res.status(200).json({ ok: true, token, user: { id: user._id, email: user.email } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Me
router.get('/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ ok: true, user: { id: payload.sub, email: payload.email } });
  } catch {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
});

module.exports = router;
