const express = require('express');
const router = express.Router();
const { query, queryOne, getPool } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM saldo_logistica ORDER BY data DESC, id DESC');
    res.json(rows.map(r => ({
      id: r.id, valor: r.valor, descricao: r.descricao, data: r.data, criadoEm: r.criado_em,
    })));
  } catch (err) { next(err); }
});

router.get('/global', async (req, res, next) => {
  try {
    const saldo = await queryOne('SELECT COALESCE(SUM(valor), 0) as total FROM saldo_logistica');
    const gastos = await queryOne('SELECT COALESCE(SUM(valor), 0) as total FROM gastos_logistica');
    res.json({
      totalSaldo: Number(saldo?.total || 0),
      totalGasto: Number(gastos?.total || 0),
      saldoDisponivel: Number(saldo?.total || 0) - Number(gastos?.total || 0),
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.valor || Number(b.valor) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' });
    const now = new Date().toISOString().slice(0,10);
    const pool = getPool();
    const [info] = await pool.query(
      'INSERT INTO saldo_logistica (tecnico_id, valor, descricao, data, criado_em) VALUES (?,?,?,?,?)',
      [null, b.valor, b.descricao||'', b.data || now, now]
    );
    res.json({ id: info.insertId, valor: b.valor, descricao: b.descricao||'', data: b.data||now, criadoEm: now });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM saldo_logistica WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
