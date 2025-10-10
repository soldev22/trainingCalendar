{{ ... }}
app.use('/api/blackouts', require('./routes/blackouts'));
app.use('/api/admin', require('./routes/admin'));

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

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// For any other request, serve the frontend's index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Start the server
app.listen(PORT, () => {
{{ ... }}
