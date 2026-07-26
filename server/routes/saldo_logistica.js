const express = require('express');
const router = express.Router();
const { query, queryOne, getPool } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT s.*, t.nome as tecnico_nome
      FROM saldo_logistica s
      LEFT JOIN tecnicos t ON t.id = s.tecnico_id
      ORDER BY s.data DESC, s.id DESC
    `);
    res.json(rows.map(r => ({
      id: r.id, tecnicoId: r.tecnico_id, tecnicoNome: r.tecnico_nome,
      valor: r.valor, descricao: r.descricao, data: r.data, criadoEm: r.criado_em,
    })));
  } catch (err) { next(err); }
});

router.get('/saldo-por-tecnico', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        t.id as tecnico_id,
        t.nome as tecnico_nome,
        COALESCE(SUM(s.valor), 0) as total_saldo,
        COALESCE(g.total_gasto, 0) as total_gasto,
        COALESCE(SUM(s.valor), 0) - COALESCE(g.total_gasto, 0) as saldo_disponivel
      FROM tecnicos t
      LEFT JOIN saldo_logistica s ON s.tecnico_id = t.id
      LEFT JOIN (
        SELECT tecnico_id, SUM(valor) as total_gasto
        FROM gastos_logistica GROUP BY tecnico_id
      ) g ON g.tecnico_id = t.id
      GROUP BY t.id, t.nome, g.total_gasto
      ORDER BY t.nome
    `);
    res.json(rows.map(r => ({
      tecnicoId: r.tecnico_id,
      tecnicoNome: r.tecnico_nome,
      totalSaldo: Number(r.total_saldo),
      totalGasto: Number(r.total_gasto),
      saldoDisponivel: Number(r.saldo_disponivel),
    })));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.tecnicoId) return res.status(400).json({ error: 'tecnicoId é obrigatório' });
    if (!b.valor || Number(b.valor) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' });
    const now = new Date().toISOString().slice(0,10);
    const pool = getPool();
    const [info] = await pool.query(
      'INSERT INTO saldo_logistica (tecnico_id, valor, descricao, data, criado_em) VALUES (?,?,?,?,?)',
      [b.tecnicoId, b.valor, b.descricao||'', b.data || now, now]
    );
    res.json({ id: info.insertId, tecnicoId: b.tecnicoId, valor: b.valor, descricao: b.descricao||'', data: b.data||now, criadoEm: now });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM saldo_logistica WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
