const express = require('express');
const router = express.Router();
const { query, queryOne, getDb } = require('../db/database');

function mapAus(r) {
  return {
    id: r.id, tecnicoId: r.tecnico_id, tipo: r.tipo, inicio: r.inicio, fim: r.fim,
    meioDia: !!r.meio_dia, motivo: r.motivo, observacoes: r.observacoes, estado: r.estado,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM ausencias ORDER BY inicio');
    res.json(rows.map(mapAus));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.tecnicoId || !b.inicio || !b.fim) return res.status(400).json({ error: 'Campos obrigatórios em falta' });
    const db = await getDb();
    try {
      const [info] = await db.execute(
        'INSERT INTO ausencias (tecnico_id, tipo, inicio, fim, meio_dia, motivo, observacoes, estado) VALUES (?,?,?,?,?,?,?,?)',
        [b.tecnicoId, b.tipo||'Férias', b.inicio, b.fim, b.meioDia?1:0, b.motivo||'', b.observacoes||'', b.estado||'Pendente']
      );
      res.json({ id: info.insertId, ...b });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await query(
      'UPDATE ausencias SET tecnico_id=?, tipo=?, inicio=?, fim=?, meio_dia=?, motivo=?, observacoes=?, estado=? WHERE id=?',
      [b.tecnicoId, b.tipo||'Férias', b.inicio, b.fim, b.meioDia?1:0, b.motivo||'', b.observacoes||'', b.estado||'Pendente', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM ausencias WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
