const express = require('express');
const router = express.Router();
const { query, queryOne, getDb } = require('../db/database');

function mapPlano(r) {
  return {
    id: r.id, escolaId: r.escola_id, titulo: r.titulo, responsavelId: r.responsavel_id,
    versao: r.versao, estado: r.estado, observacoes: r.observacoes,
    criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
  };
}

function mapLinha(r) {
  return {
    id: r.id, planoId: r.plano_id, dia: r.dia, data: r.data, hora: r.hora,
    duracao: r.duracao, objetivo: r.objetivo, tecnicoId: r.tecnico_id,
  };
}

function mapParticipante(r) {
  return {
    id: r.id, planoId: r.plano_id, nome: r.nome, cargo: r.cargo,
    email: r.email, telefone: r.telefone, instituicao: r.instituicao,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const planos = (await query('SELECT * FROM planos_formacao ORDER BY atualizado_em DESC')).map(mapPlano);
    for (const p of planos) {
      p.linhas = (await query('SELECT * FROM plano_linhas WHERE plano_id=? ORDER BY id', [p.id])).map(mapLinha);
      p.participantes = (await query('SELECT * FROM plano_participantes WHERE plano_id=? ORDER BY id', [p.id])).map(mapParticipante);
    }
    res.json(planos);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await queryOne('SELECT * FROM planos_formacao WHERE id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const plano = mapPlano(p);
    plano.linhas = (await query('SELECT * FROM plano_linhas WHERE plano_id=? ORDER BY id', [p.id])).map(mapLinha);
    plano.participantes = (await query('SELECT * FROM plano_participantes WHERE plano_id=? ORDER BY id', [p.id])).map(mapParticipante);
    res.json(plano);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    const db = await getDb();
    try {
      const [info] = await db.execute(
        'INSERT INTO planos_formacao (escola_id, titulo, responsavel_id, versao, estado, observacoes, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?)',
        [b.escolaId||null, b.titulo||'', b.responsavelId||null, b.versao||'v1.0', b.estado||'Rascunho', b.observacoes||'', now, now]
      );
      const planoId = info.insertId;
      if (b.linhas && b.linhas.length) {
        const stmt = await db.prepare('INSERT INTO plano_linhas (plano_id, dia, data, hora, duracao, objetivo, tecnico_id) VALUES (?,?,?,?,?,?,?)');
        for (const l of b.linhas) {
          await stmt.execute([planoId, l.dia||'', l.data, l.hora||'08:00', l.duracao||'2h', l.objetivo||'', l.tecnicoId||null]);
        }
      }
      if (b.participantes && b.participantes.length) {
        const stmtP = await db.prepare('INSERT INTO plano_participantes (plano_id, nome, cargo, email, telefone, instituicao) VALUES (?,?,?,?,?,?)');
        for (const p of b.participantes) {
          await stmtP.execute([planoId, p.nome||'', p.cargo||'', p.email||'', p.telefone||'', p.instituicao||'']);
        }
      }
      res.json({ id: planoId, ...b, criadoEm: now, atualizadoEm: now });
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
        'UPDATE planos_formacao SET escola_id=?, titulo=?, responsavel_id=?, versao=?, estado=?, observacoes=?, atualizado_em=? WHERE id=?',
        [b.escolaId||null, b.titulo||'', b.responsavelId||null, b.versao||'v1.0', b.estado||'Rascunho', b.observacoes||'', now, req.params.id]
      );
      await db.execute('DELETE FROM plano_linhas WHERE plano_id=?', [req.params.id]);
      if (b.linhas && b.linhas.length) {
        const stmt = await db.prepare('INSERT INTO plano_linhas (plano_id, dia, data, hora, duracao, objetivo, tecnico_id) VALUES (?,?,?,?,?,?,?)');
        for (const l of b.linhas) {
          await stmt.execute([req.params.id, l.dia||'', l.data, l.hora||'08:00', l.duracao||'2h', l.objetivo||'', l.tecnicoId||null]);
        }
      }
      await db.execute('DELETE FROM plano_participantes WHERE plano_id=?', [req.params.id]);
      if (b.participantes && b.participantes.length) {
        const stmtP = await db.prepare('INSERT INTO plano_participantes (plano_id, nome, cargo, email, telefone, instituicao) VALUES (?,?,?,?,?,?)');
        for (const p of b.participantes) {
          await stmtP.execute([req.params.id, p.nome||'', p.cargo||'', p.email||'', p.telefone||'', p.instituicao||'']);
        }
      }
      res.json({ ok: true });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM plano_linhas WHERE plano_id=?', [req.params.id]);
    await query('DELETE FROM plano_participantes WHERE plano_id=?', [req.params.id]);
    await query('DELETE FROM planos_formacao WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
