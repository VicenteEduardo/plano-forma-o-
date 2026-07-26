const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, getDb } = require('../db/database');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'notas');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'nota_' + Date.now() + '_' + Math.round(Math.random() * 1e6) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM notas ORDER BY criado_em DESC');
    res.json(rows.map(r => ({ id: r.id, titulo: r.titulo, descricao: r.descricao, imagem: r.imagem, criadoEm: r.criado_em })));
  } catch (err) { next(err); }
});

router.post('/upload', upload.single('imagem'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro enviado' });
    const url = '/uploads/notas/' + req.file.filename;
    res.json({ ok: true, url });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.titulo) return res.status(400).json({ error: 'titulo é obrigatório' });
    const now = new Date().toISOString().slice(0,10);
    const db = await getDb();
    try {
      const [info] = await db.execute('INSERT INTO notas (titulo, descricao, imagem, criado_em) VALUES (?,?,?,?)', [b.titulo, b.descricao||'', b.imagem||null, now]);
      res.json({ id: info.insertId, titulo: b.titulo, descricao: b.descricao, imagem: b.imagem, criadoEm: now });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (b.imagem === null || (typeof b.imagem === 'string' && b.imagem.startsWith('/uploads/'))) {
      const existing = await query('SELECT imagem FROM notas WHERE id=?', [req.params.id]);
      if (existing.length && existing[0].imagem && existing[0].imagem.startsWith('/uploads/') && existing[0].imagem !== b.imagem) {
        const filePath = path.join(__dirname, '..', '..', 'public', existing[0].imagem);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    await query('UPDATE notas SET titulo=?, descricao=?, imagem=? WHERE id=?', [b.titulo, b.descricao||'', b.imagem||null, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await query('SELECT imagem FROM notas WHERE id=?', [req.params.id]);
    if (row.length && row[0].imagem && row[0].imagem.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', '..', 'public', row[0].imagem);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query('DELETE FROM notas WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
