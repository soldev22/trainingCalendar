{{ ... }}
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/blackouts', require('./routes/blackouts'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth/microsoft', require('./routes/auth_microsoft'));

// Health check route - MUST be before the static file serving
app.get('/health', (req, res) => {
