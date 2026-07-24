const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Proxy: fetch external school logos to avoid CORS
app.get('/api/escola-logo', async (req, res, next) => {
  try {
    const logoPath = req.query.path;
    if (!logoPath) return res.status(400).send('Missing path');
    const url = 'https://eduall.site/' + logoPath.replace(/^\//, '');
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return res.status(resp.status).send('Upstream error');
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = await resp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

// API Routes
app.use('/api/escolas', require('./routes/escolas'));
app.use('/api/tecnicos', require('./routes/tecnicos'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api/ausencias', require('./routes/ausencias'));
app.use('/api/reunioes', require('./routes/reunioes'));
app.use('/api/planos', require('./routes/planos'));
app.use('/api/notas', require('./routes/notas'));
app.use('/api/ocorrencias', require('./routes/ocorrencias'));

// Conflict check endpoint
app.use('/api/conflictos', require('./routes/conflictos'));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

async function start() {
  app.listen(PORT, () => {
    console.log(`Eduall Software server running at http://localhost:${PORT}`);
  });
  try {
    await initSchema();
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Database init failed (server still running):', err.message);
  }
}

start();
