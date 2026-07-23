const express = require('express');
const router = express.Router();
const { query, queryOne, getDb } = require('../db/database');

function mapReu(r) {
  return {
    id: r.id, escolaId: r.escola_id, data: r.data, horaInicio: r.hora_inicio, horaFim: r.hora_fim,
    estado: r.estado, direcaoEscola: r.direcao_escola, direcaoEduall: r.direcao_eduall,
    administracaoEduall: r.administracao_eduall, tecnicoId: r.tecnico_id,
    outrosParticipantes: r.outros_participantes, objetivos: r.objetivos, assuntos: r.assuntos,
    descricao: r.descricao, decisoes: r.decisoes, notas: r.notas, proximosPassos: r.proximos_passos,
    criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM reunioes ORDER BY data DESC');
    const mapped = rows.map(mapReu);
    for (const r of mapped) {
      r.historico = await query('SELECT data, acao FROM reuniao_historico WHERE reuniao_id=? ORDER BY data', [r.id]);
    }
    res.json(mapped);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    const db = await getDb();
    try {
      const [info] = await db.execute(
        'INSERT INTO reunioes (escola_id, data, hora_inicio, hora_fim, estado, direcao_escola, direcao_eduall, administracao_eduall, tecnico_id, outros_participantes, objetivos, assuntos, descricao, decisoes, notas, proximos_passos, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [b.escolaId||null, b.data, b.horaInicio||'09:00', b.horaFim||'10:00', b.estado||'Pendente',
         b.direcaoEscola||'', b.direcaoEduall||'', b.administracaoEduall||'', b.tecnicoId||null,
         b.outrosParticipantes||'', b.objetivos||'', b.assuntos||'', b.descricao||'', b.decisoes||'',
         b.notas||'', b.proximosPassos||'', now, now]
      );
      await db.execute('INSERT INTO reuniao_historico (reuniao_id, data, acao) VALUES (?,?,?)', [info.insertId, now, 'Reunião criada']);
      res.json({ id: info.insertId, ...b });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    const old = await queryOne('SELECT estado FROM reunioes WHERE id=?', [req.params.id]);
    await query(
      'UPDATE reunioes SET escola_id=?, data=?, hora_inicio=?, hora_fim=?, estado=?, direcao_escola=?, direcao_eduall=?, administracao_eduall=?, tecnico_id=?, outros_participantes=?, objetivos=?, assuntos=?, descricao=?, decisoes=?, notas=?, proximos_passos=?, atualizado_em=? WHERE id=?',
      [b.escolaId||null, b.data, b.horaInicio||'09:00', b.horaFim||'10:00', b.estado||'Pendente',
       b.direcaoEscola||'', b.direcaoEduall||'', b.administracaoEduall||'', b.tecnicoId||null,
       b.outrosParticipantes||'', b.objetivos||'', b.assuntos||'', b.descricao||'', b.decisoes||'',
       b.notas||'', b.proximosPassos||'', now, req.params.id]
    );
    const acao = (old && old.estado !== b.estado) ? `Estado alterado para ${b.estado}` : 'Reunião atualizada';
    await query('INSERT INTO reuniao_historico (reuniao_id, data, acao) VALUES (?,?,?)', [req.params.id, now, acao]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM reunioes WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
