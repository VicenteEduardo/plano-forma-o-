const express = require('express');
const router = express.Router();
const { query, queryOne, getPool } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    let sql = `SELECT g.*, t.nome as tecnico_nome, e.nome as escola_nome
      FROM gastos_logistica g
      LEFT JOIN tecnicos t ON t.id = g.tecnico_id
      LEFT JOIN escolas e ON e.id = g.escola_id`;
    const params = [];
    if (req.query.categoria) { sql += ' WHERE g.categoria=?'; params.push(req.query.categoria); }
    sql += ' ORDER BY g.data DESC, g.id DESC';
    const rows = await query(sql, params);
    res.json(rows.map(r => ({
      id: r.id, tecnicoId: r.tecnico_id, tecnicoNome: r.tecnico_nome,
      escolaId: r.escola_id, escolaNome: r.escola_nome,
      tipo: r.tipo, valor: Number(r.valor), data: r.data,
      observacoes: r.observacoes, criadoEm: r.criado_em,
      categoria: r.categoria || 'tecnicos',
    })));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
});

router.get('/resumo', async (req, res, next) => {
  try {
    let porTipo = [], porTecnico = [], total = { total: 0, cnt: 0 };
    try {
      porTipo = await query(`
        SELECT tipo, categoria, SUM(valor) as total, COUNT(*) as cnt
        FROM gastos_logistica GROUP BY tipo, categoria ORDER BY total DESC
      `);
      porTecnico = await query(`
        SELECT t.nome, g.tecnico_id, g.categoria, SUM(g.valor) as total
        FROM gastos_logistica g JOIN tecnicos t ON t.id=g.tecnico_id
        GROUP BY g.tecnico_id, t.nome, g.categoria ORDER BY total DESC
      `);
      total = await queryOne('SELECT SUM(valor) as total, COUNT(*) as cnt FROM gastos_logistica');
    } catch (_) {}
    res.json({
      total: Number(total?.total || 0),
      count: Number(total?.cnt || 0),
      porTipo: porTipo.map(r => ({ tipo: r.tipo, categoria: r.categoria, total: Number(r.total), count: r.cnt })),
      porTecnico: porTecnico.map(r => ({ tecnicoId: r.tecnico_id, nome: r.nome, categoria: r.categoria, total: Number(r.total) })),
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.tecnicoId) return res.status(400).json({ error: 'tecnicoId é obrigatório' });
    if (!b.valor || Number(b.valor) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' });
    if (!b.tipo) return res.status(400).json({ error: 'Tipo é obrigatório' });
    const cat = ['tecnicos', 'comerciais'].includes(b.categoria) ? b.categoria : 'tecnicos';

    const pool = getPool();
    const now = new Date().toISOString().slice(0,10);

    const [saldoRow] = await pool.query(
      'SELECT COALESCE(SUM(valor), 0) as total_saldo FROM saldo_logistica WHERE categoria=?', [cat]
    );
    const [gastoRow] = await pool.query(
      'SELECT COALESCE(SUM(valor), 0) as total_gasto FROM gastos_logistica WHERE categoria=?', [cat]
    );
    const saldo = Number(saldoRow[0]?.total_saldo || 0) - Number(gastoRow[0]?.total_gasto || 0);

    if (saldo < Number(b.valor)) {
      return res.status(400).json({
        error: `Saldo insuficiente (${cat}). Disponível: ${saldo.toFixed(2)} Kz`,
        saldoDisponivel: saldo,
      });
    }

    const [info] = await pool.query(
      'INSERT INTO gastos_logistica (tecnico_id, escola_id, tipo, valor, data, observacoes, criado_em, categoria) VALUES (?,?,?,?,?,?,?,?)',
      [b.tecnicoId, b.escolaId||null, b.tipo, b.valor, b.data||now, b.observacoes||'', now, cat]
    );
    res.json({
      id: info.insertId, tecnicoId: b.tecnicoId, escolaId: b.escolaId||null,
      tipo: b.tipo, valor: Number(b.valor), data: b.data||now,
      observacoes: b.observacoes||'', criadoEm: now, categoria: cat,
    });
  } catch (err) { console.error('Erro ao criar gasto:', err); next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    const cat = ['tecnicos', 'comerciais'].includes(b.categoria) ? b.categoria : 'tecnicos';
    await query(
      'UPDATE gastos_logistica SET tecnico_id=?, escola_id=?, tipo=?, valor=?, data=?, observacoes=?, categoria=? WHERE id=?',
      [b.tecnicoId, b.escolaId||null, b.tipo, b.valor, b.data||now, b.observacoes||'', cat, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM gastos_logistica WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
