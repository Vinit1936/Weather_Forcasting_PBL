require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./config/db');
const authRoutes = require('./backend/routes/auth');
const weatherRoutes = require('./backend/routes/weather');
const travelRoutes = require('./backend/routes/travel');
const errorHandler = require('./backend/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const UI_ROOT = path.join(__dirname);

app.use(cors());
app.use(express.json());

// Serve frontend files from the current UI root (index.html, login.html, css/, js/)
app.use(express.static(UI_ROOT));

app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/travel', travelRoutes);

app.use('/api', (_req, res) => {
  return res.status(404).json({
    success: false,
    message: 'API route not found',
    data: null,
  });
});

// SPA-style fallback for non-API routes
app.get(/^\/(?!api).*/, (_req, res) => {
  return res.sendFile(path.join(UI_ROOT, 'index.html'));
});

// Global error handler should be last
app.use(errorHandler);

async function startServer() {
  try {
    await db.query('SELECT 1');
    console.log('Database connection test passed');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server due to DB error:', error.message);
    process.exit(1);
  }
}

startServer();
