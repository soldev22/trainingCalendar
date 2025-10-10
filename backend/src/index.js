{{ ... }}
app.use('/api/admin', require('./routes/admin'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// For any other request, serve the frontend's index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.get('/health', (req, res) => {
