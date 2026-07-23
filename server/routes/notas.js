const express = require('express');
const router = express.Router();
const { query, getDb } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM notas ORDER BY criado_em DESC');
    res.json(rows.map(r => ({ id: r.id, titulo: r.titulo, descricao: r.descricao, imagem: r.imagem, criadoEm: r.criado_em })));
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
    await query('UPDATE notas SET titulo=?, descricao=?, imagem=? WHERE id=?', [b.titulo, b.descricao||'', b.imagem||null, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM notas WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
