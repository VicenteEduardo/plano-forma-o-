const express = require('express');
const router = express.Router();
const { query, queryOne, getPool } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    let sql = 'SELECT * FROM saldo_logistica';
    const params = [];
    if (req.query.categoria) { sql += ' WHERE categoria=?'; params.push(req.query.categoria); }
    sql += ' ORDER BY data DESC, id DESC';
    const rows = await query(sql, params);
    res.json(rows.map(r => ({
      id: r.id, valor: Number(r.valor), descricao: r.descricao, data: r.data, criadoEm: r.criado_em,
      categoria: r.categoria || 'tecnicos',
    })));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
});

router.get('/global', async (req, res, next) => {
  try {
    const cats = ['tecnicos', 'comerciais'];
    const result = {};
    let totalSaldo = 0, totalGasto = 0, saldoDisponivel = 0;
    for (const cat of cats) {
      let s = 0, g = 0;
      try {
        const saldo = await queryOne('SELECT COALESCE(SUM(valor), 0) as total FROM saldo_logistica WHERE categoria=?', [cat]);
        s = Number(saldo?.total || 0);
      } catch (_) {}
      try {
        const gastos = await queryOne('SELECT COALESCE(SUM(valor), 0) as total FROM gastos_logistica WHERE categoria=?', [cat]);
        g = Number(gastos?.total || 0);
      } catch (_) {}
      result[cat] = { totalSaldo: s, totalGasto: g, saldoDisponivel: s - g };
      totalSaldo += s; totalGasto += g; saldoDisponivel += (s - g);
    }
    result.total = { totalSaldo, totalGasto, saldoDisponivel };
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.valor || Number(b.valor) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' });
    const now = new Date().toISOString().slice(0,10);
    const cat = ['tecnicos', 'comerciais'].includes(b.categoria) ? b.categoria : 'tecnicos';
    const pool = getPool();
    const [info] = await pool.query(
      'INSERT INTO saldo_logistica (tecnico_id, valor, descricao, data, criado_em, categoria) VALUES (?,?,?,?,?,?)',
      [null, b.valor, b.descricao||'', b.data || now, now, cat]
    );
    res.json({ id: info.insertId, valor: Number(b.valor), descricao: b.descricao||'', data: b.data||now, criadoEm: now, categoria: cat });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.valor || Number(b.valor) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' });
    const cat = ['tecnicos', 'comerciais'].includes(b.categoria) ? b.categoria : 'tecnicos';
    await query(
      'UPDATE saldo_logistica SET valor=?, descricao=?, data=?, categoria=? WHERE id=?',
      [b.valor, b.descricao||'', b.data || new Date().toISOString().slice(0,10), cat, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const saldo = await queryOne('SELECT valor, categoria FROM saldo_logistica WHERE id=?', [req.params.id]);
    if (!saldo) return res.status(404).json({ error: 'Entrada de saldo não encontrada' });
    const cat = saldo.categoria || 'tecnicos';

    const saldoCat = await queryOne('SELECT COALESCE(SUM(valor), 0) as total FROM saldo_logistica WHERE id!=? AND categoria=?', [req.params.id, cat]);
    const gastosCat = await queryOne('SELECT COALESCE(SUM(valor), 0) as total FROM gastos_logistica WHERE categoria=?', [cat]);
    const novoSaldo = Number(saldoCat?.total || 0) - Number(gastosCat?.total || 0);

    if (novoSaldo < 0) {
      return res.status(400).json({
        error: `Não é possível remover: o saldo de ${cat} ficaria negativo (${novoSaldo.toFixed(2)} Kz). Remova primeiro os gastos.`,
        saldoDisponivel: novoSaldo,
      });
    }

    await query('DELETE FROM saldo_logistica WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
