const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne, getDb } = require('../db/database');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'tecnicos');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'tech_' + Date.now() + '_' + Math.round(Math.random() * 1e6) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function mapTec(r) {
  return {
    id: r.id, nome: r.nome, email: r.email, telefone: r.telefone,
    area: r.area, equipa: r.equipa, estado: r.estado,
    horaInicio: r.hora_inicio, horaFim: r.hora_fim,
    foto: r.foto || '',
  };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM tecnicos ORDER BY nome');
    res.json(rows.map(mapTec));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await queryOne('SELECT * FROM tecnicos WHERE id=?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(mapTec(row));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { nome, email, telefone, area, equipa, estado, horaInicio, horaFim, foto } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
    const db = await getDb();
    try {
      const [info] = await db.execute(
        'INSERT INTO tecnicos (nome, email, telefone, area, equipa, estado, hora_inicio, hora_fim, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nome, email||'', telefone||'', area||'', equipa||'', estado||'Disponível', horaInicio||'08:00', horaFim||'17:00', foto||'']
      );
      res.json({ id: info.insertId, nome, email, telefone, area, equipa, estado, horaInicio: horaInicio||'08:00', horaFim: horaFim||'17:00', foto: foto||'' });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nome, email, telefone, area, equipa, estado, horaInicio, horaFim, foto } = req.body;
    await query(
      'UPDATE tecnicos SET nome=?, email=?, telefone=?, area=?, equipa=?, estado=?, hora_inicio=?, hora_fim=?, foto=? WHERE id=?',
      [nome, email||'', telefone||'', area||'', equipa||'', estado||'Disponível', horaInicio||'08:00', horaFim||'17:00', foto||'', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await queryOne('SELECT foto FROM tecnicos WHERE id=?', [req.params.id]);
    if (row && row.foto) {
      const filePath = path.join(__dirname, '..', '..', 'public', row.foto);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query('DELETE FROM tecnicos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/foto', upload.single('foto'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro enviado' });
    const fotoUrl = 'uploads/tecnicos/' + req.file.filename;
    await query('UPDATE tecnicos SET foto=? WHERE id=?', [fotoUrl, req.params.id]);
    res.json({ ok: true, foto: fotoUrl });
  } catch (err) { next(err); }
});

module.exports = router;
