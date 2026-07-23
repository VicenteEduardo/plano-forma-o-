const express = require('express');
const router = express.Router();
const { query, queryOne, getDb } = require('../db/database');

function mapOcor(r) {
  return {
    id: r.id, titulo: r.titulo, escolaId: r.escola_id, descricao: r.descricao,
    tecnicoId: r.tecnico_id, eventoId: r.evento_id, prioridade: r.prioridade,
    gravidade: r.gravidade, estado: r.estado, resolucao: r.resolucao,
    criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = (await query('SELECT * FROM ocorrencias ORDER BY atualizado_em DESC')).map(mapOcor);
    for (const o of rows) {
      o.fotos = (await query('SELECT dados FROM ocorrencia_fotos WHERE ocorrencia_id=?', [o.id])).map(f => f.dados);
      const vid = await queryOne('SELECT dados FROM ocorrencia_videos WHERE ocorrencia_id=?', [o.id]);
      o.video = vid ? vid.dados : null;
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const r = await queryOne('SELECT * FROM ocorrencias WHERE id=?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const o = mapOcor(r);
    o.fotos = (await query('SELECT dados FROM ocorrencia_fotos WHERE ocorrencia_id=?', [o.id])).map(f => f.dados);
    const vid = await queryOne('SELECT dados FROM ocorrencia_videos WHERE ocorrencia_id=?', [o.id]);
    o.video = vid ? vid.dados : null;
    res.json(o);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    if (!b.titulo || !b.descricao) return res.status(400).json({ error: 'titulo e descricao são obrigatórios' });
    const db = await getDb();
    try {
      const [info] = await db.execute(
        'INSERT INTO ocorrencias (titulo, escola_id, descricao, tecnico_id, evento_id, prioridade, gravidade, estado, resolucao, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [b.titulo, b.escolaId||null, b.descricao, b.tecnicoId||null, b.eventoId||null,
         b.prioridade||'Média', b.gravidade||'Moderada', b.estado||'Aberta', b.resolucao||'', now, now]
      );
      const ocorId = info.insertId;
      if (b.fotos && b.fotos.length) {
        const stmt = await db.prepare('INSERT INTO ocorrencia_fotos (ocorrencia_id, dados) VALUES (?,?)');
        for (const f of b.fotos) await stmt.execute([ocorId, f]);
      }
      if (b.video) {
        await db.execute('INSERT INTO ocorrencia_videos (ocorrencia_id, dados) VALUES (?,?)', [ocorId, b.video]);
      }
      res.json({ id: ocorId, ...b, criadoEm: now, atualizadoEm: now });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    const db = await getDb();
    try {
      await db.execute(
        'UPDATE ocorrencias SET titulo=?, escola_id=?, descricao=?, tecnico_id=?, evento_id=?, prioridade=?, gravidade=?, estado=?, resolucao=?, atualizado_em=? WHERE id=?',
        [b.titulo, b.escolaId||null, b.descricao, b.tecnicoId||null, b.eventoId||null,
         b.prioridade||'Média', b.gravidade||'Moderada', b.estado||'Aberta', b.resolucao||'', now, req.params.id]
      );
      await db.execute('DELETE FROM ocorrencia_fotos WHERE ocorrencia_id=?', [req.params.id]);
      await db.execute('DELETE FROM ocorrencia_videos WHERE ocorrencia_id=?', [req.params.id]);
      if (b.fotos && b.fotos.length) {
        const stmt = await db.prepare('INSERT INTO ocorrencia_fotos (ocorrencia_id, dados) VALUES (?,?)');
        for (const f of b.fotos) await stmt.execute([req.params.id, f]);
      }
      if (b.video) {
        await db.execute('INSERT INTO ocorrencia_videos (ocorrencia_id, dados) VALUES (?,?)', [req.params.id, b.video]);
      }
      res.json({ ok: true });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM ocorrencias WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
