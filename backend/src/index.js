const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// attach maybeAuth for all requests so routes can read req.user if present
try {
  const { maybeAuth } = require('./middleware/auth');
  app.use(maybeAuth);
} catch {}

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || '';

// Connect to MongoDB Atlas via Mongoose
async function initMongo() {
  if (!MONGODB_URI) {
    console.warn('[backend] MONGODB_URI is not set. /health/db will report not configured.');
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[backend] Connected to MongoDB via Mongoose');
  } catch (err) {
    console.error('[backend] Initial Mongo connection failed:', err.message);
  }
}

// Health route to check DB connectivity
app.get('/health/db', async (req, res) => {
  try {
    if (!MONGODB_URI) {
      return res.status(200).json({ ok: false, configured: false, message: 'MONGODB_URI not set' });
    }

    const state = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting

    let pingResult = null;
    let pingOk = false;
    if (mongoose.connection.db) {
      try {
        // Use admin ping to verify actual connectivity
        const admin = mongoose.connection.db.admin();
        await admin.ping();
        pingResult = 'pong';
        pingOk = true;
      } catch (e) {
        pingResult = e.message;
      }
    }

    return res.status(200).json({
      ok: pingOk || state === 1,
      configured: true,
      mongooseState: state,
      ping: pingResult,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/blackouts', require('./routes/blackouts'));
app.use('/api/admin', require('./routes/admin'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// For any other request, serve the frontend's index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`[backend] Server listening on http://localhost:${PORT}`);
  initMongo();
});

module.exports = app;
