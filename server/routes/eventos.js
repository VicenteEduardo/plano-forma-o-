const express = require('express');
const router = express.Router();
const { query, queryOne, getDb } = require('../db/database');

function mapEvt(r, techIds) {
  return {
    id: r.id, titulo: r.titulo, descricao: r.descricao, data: r.data,
    horaInicio: r.hora_inicio, horaFim: r.hora_fim,
    tecnicoId: r.tecnico_id,
    tecnicoIds: techIds || (r.tecnico_id ? [r.tecnico_id] : []),
    escolaId: r.escola_id, local: r.local, prioridade: r.prioridade,
    estado: r.estado, tipo: r.tipo, responsavel: r.responsavel, observacoes: r.observacoes,
  };
}

async function loadTechIds(eventoIds) {
  if (!eventoIds.length) return {};
  const rows = await query(`SELECT evento_id, GROUP_CONCAT(tecnico_id) as ids FROM evento_tecnicos WHERE evento_id IN (${eventoIds.map(()=>'?').join(',')}) GROUP BY evento_id`, eventoIds);
  const map = {};
  rows.forEach(r => { map[r.evento_id] = r.ids.split(',').map(Number); });
  return map;
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM eventos ORDER BY data, hora_inicio');
    const techMap = await loadTechIds(rows.map(r => r.id));
    res.json(rows.map(r => mapEvt(r, techMap[r.id])));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const r = await queryOne('SELECT * FROM eventos WHERE id=?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const techMap = await loadTechIds([r.id]);
    res.json(mapEvt(r, techMap[r.id]));
  } catch (err) { next(err); }
});

async function saveTechIds(db, eventoId, tecnicoIds) {
  await db.execute('DELETE FROM evento_tecnicos WHERE evento_id=?', [eventoId]);
  if (tecnicoIds && tecnicoIds.length) {
    const stmt = await db.prepare('INSERT INTO evento_tecnicos (evento_id, tecnico_id) VALUES (?,?)');
    for (const tid of tecnicoIds) {
      await stmt.execute([eventoId, tid]);
    }
  }
}

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const techIds = b.tecnicoIds || (b.tecnicoId ? [b.tecnicoId] : []);
    if (!b.titulo || !b.data || !b.horaInicio || !b.horaFim || !techIds.length)
      return res.status(400).json({ error: 'Campos obrigatórios em falta' });
    const db = await getDb();
    try {
      const [info] = await db.execute(
        'INSERT INTO eventos (titulo, descricao, data, hora_inicio, hora_fim, tecnico_id, escola_id, local, prioridade, estado, tipo, responsavel, observacoes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [b.titulo, b.descricao||'', b.data, b.horaInicio, b.horaFim, techIds[0], b.escolaId||null, b.local||'', b.prioridade||'Média', b.estado||'Agendado', b.tipo||'Outros', b.responsavel||'Técnico', b.observacoes||'']
      );
      await saveTechIds(db, info.insertId, techIds);
      res.json({ id: info.insertId, ...b, tecnicoIds: techIds });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const techIds = b.tecnicoIds || (b.tecnicoId ? [b.tecnicoId] : []);
    const db = await getDb();
    try {
      await db.execute(
        'UPDATE eventos SET titulo=?, descricao=?, data=?, hora_inicio=?, hora_fim=?, tecnico_id=?, escola_id=?, local=?, prioridade=?, estado=?, tipo=?, responsavel=?, observacoes=? WHERE id=?',
        [b.titulo, b.descricao||'', b.data, b.horaInicio, b.horaFim, techIds[0]||null, b.escolaId||null, b.local||'', b.prioridade||'Média', b.estado||'Agendado', b.tipo||'Outros', b.responsavel||'Técnico', b.observacoes||'', req.params.id]
      );
      await saveTechIds(db, req.params.id, techIds);
      res.json({ ok: true });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM evento_tecnicos WHERE evento_id=?', [req.params.id]);
    await query('DELETE FROM eventos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
