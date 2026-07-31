const express = require('express');
const router = express.Router();
const { query, getDb } = require('../db/database');

function mapAcesso(r) {
  return {
    id: r.id, escolaId: r.escola_id, escolaNome: r.escola_nome || '', escolaCodigo: r.escola_codigo || '',
    username: r.username, password: r.password, tipoAcesso: r.tipo_acesso,
    observacoes: r.observacoes || '', criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { escola_id } = req.query;
    let sql = `SELECT a.*, e.nome AS escola_nome, e.codigo AS escola_codigo
               FROM acessos_escolas a LEFT JOIN escolas e ON e.id = a.escola_id`;
    const params = [];
    if (escola_id) { sql += ' WHERE a.escola_id = ?'; params.push(escola_id); }
    sql += ' ORDER BY e.nome, a.id';
    res.json((await query(sql, params)).map(mapAcesso));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.escolaId || !b.username || !b.password || !b.tipoAcesso)
      return res.status(400).json({ error: 'escolaId, username, password e tipoAcesso são obrigatórios' });
    const now = new Date().toISOString().slice(0, 10);
    const db = await getDb();
    try {
      const [info] = await db.execute(
        'INSERT INTO acessos_escolas (escola_id, username, password, tipo_acesso, observacoes, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?)',
        [b.escolaId, b.username.trim(), b.password, b.tipoAcesso.trim(), b.observacoes || '', now, now]
      );
      res.json({ id: info.insertId, ...b, criadoEm: now, atualizadoEm: now });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.escolaId || !b.username || !b.password || !b.tipoAcesso)
      return res.status(400).json({ error: 'escolaId, username, password e tipoAcesso são obrigatórios' });
    const now = new Date().toISOString().slice(0, 10);
    await query(
      'UPDATE acessos_escolas SET escola_id=?, username=?, password=?, tipo_acesso=?, observacoes=?, atualizado_em=? WHERE id=?',
      [b.escolaId, b.username.trim(), b.password, b.tipoAcesso.trim(), b.observacoes || '', now, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM acessos_escolas WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
