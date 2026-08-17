const express = require('express');
const router = express.Router();
const { query, queryOne, getPool } = require('../db/database');

function mapPagamento(r) {
  return {
    id: r.id, faturaId: r.fatura_id, escolaId: r.escola_id, escolaNome: r.escola_nome || '',
    faturaNumero: r.fatura_numero || '',
    valor: Number(r.valor), dataPagamento: r.data_pagamento,
    formaPagamento: r.forma_pagamento || 'Mensal',
    metodoPagamento: r.metodo_pagamento || 'Transferência',
    referencia: r.referencia || '', estado: r.estado || 'Confirmado',
    observacoes: r.observacoes || '', criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
  };
}

router.get('/resumo', async (req, res, next) => {
  try {
    const total = await queryOne("SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as cnt FROM pagamentos WHERE estado='Confirmado'");
    const pendentes = await queryOne("SELECT COALESCE(SUM(valor),0) as total, COUNT(*) as cnt FROM pagamentos WHERE estado='Pendente'");
    const porEscola = await query(`
      SELECT e.nome, p.escola_id, SUM(p.valor) as total, COUNT(*) as cnt
      FROM pagamentos p LEFT JOIN escolas e ON e.id=p.escola_id
      WHERE p.estado='Confirmado'
      GROUP BY p.escola_id, e.nome ORDER BY total DESC
    `);
    const porForma = await query(`
      SELECT forma_pagamento, SUM(valor) as total, COUNT(*) as cnt
      FROM pagamentos WHERE estado='Confirmado'
      GROUP BY forma_pagamento ORDER BY total DESC
    `);
    const porMetodo = await query(`
      SELECT metodo_pagamento, SUM(valor) as total, COUNT(*) as cnt
      FROM pagamentos WHERE estado='Confirmado'
      GROUP BY metodo_pagamento ORDER BY total DESC
    `);
    const porMes = await query(`
      SELECT SUBSTRING(data_pagamento,1,7) as mes, SUM(valor) as total, COUNT(*) as cnt
      FROM pagamentos WHERE estado='Confirmado' GROUP BY mes ORDER BY mes DESC
    `);
    const porAno = await query(`
      SELECT SUBSTRING(data_pagamento,1,4) as ano, SUM(valor) as total, COUNT(*) as cnt
      FROM pagamentos WHERE estado='Confirmado' GROUP BY ano ORDER BY ano DESC
    `);
    res.json({
      total: Number(total?.total || 0), count: Number(total?.cnt || 0),
      pendentes: Number(pendentes?.total || 0), pendentesCount: Number(pendentes?.cnt || 0),
      porEscola: porEscola.map(r => ({ escolaId: r.escola_id, nome: r.nome || 'Sem escola', total: Number(r.total), count: r.cnt })),
      porForma: porForma.map(r => ({ forma: r.forma_pagamento, total: Number(r.total), count: r.cnt })),
      porMetodo: porMetodo.map(r => ({ metodo: r.metodo_pagamento, total: Number(r.total), count: r.cnt })),
      porMes: porMes.map(r => ({ mes: r.mes, total: Number(r.total), count: r.cnt })),
      porAno: porAno.map(r => ({ ano: r.ano, total: Number(r.total), count: r.cnt })),
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    let sql = `SELECT p.*, e.nome as escola_nome, f.numero as fatura_numero
      FROM pagamentos p
      LEFT JOIN escolas e ON e.id = p.escola_id
      LEFT JOIN faturas f ON f.id = p.fatura_id`;
    const params = [];
    const wheres = [];
    if (req.query.escola_id) { wheres.push('p.escola_id=?'); params.push(req.query.escola_id); }
    if (req.query.estado) { wheres.push('p.estado=?'); params.push(req.query.estado); }
    if (req.query.forma_pagamento) { wheres.push('p.forma_pagamento=?'); params.push(req.query.forma_pagamento); }
    if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
    sql += ' ORDER BY p.data_pagamento DESC, p.id DESC';
    const rows = await query(sql, params);
    res.json(Array.isArray(rows) ? rows.map(mapPagamento) : []);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const r = await queryOne(
      `SELECT p.*, e.nome as escola_nome, f.numero as fatura_numero
       FROM pagamentos p
       LEFT JOIN escolas e ON e.id=p.escola_id
       LEFT JOIN faturas f ON f.id=p.fatura_id
       WHERE p.id=?`,
      [req.params.id]
    );
    if (!r) return res.status(404).json({ error: 'Pagamento não encontrado' });
    res.json(mapPagamento(r));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.escolaId) return res.status(400).json({ error: 'Escola é obrigatória' });
    if (!b.valor || Number(b.valor) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' });
    const now = new Date().toISOString().slice(0, 10);
    const [info] = await getPool().query(
      `INSERT INTO pagamentos (fatura_id, escola_id, valor, data_pagamento, forma_pagamento, metodo_pagamento, referencia, estado, observacoes, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [b.faturaId || null, b.escolaId, b.valor, b.dataPagamento || now, b.formaPagamento || 'Mensal', b.metodoPagamento || 'Transferência', b.referencia || '', b.estado || 'Confirmado', b.observacoes || '', now, now]
    );
    res.json({ id: info.insertId, escolaId: b.escolaId, valor: Number(b.valor) });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0, 10);
    await query(
      `UPDATE pagamentos SET fatura_id=?, escola_id=?, valor=?, data_pagamento=?, forma_pagamento=?, metodo_pagamento=?, referencia=?, estado=?, observacoes=?, atualizado_em=? WHERE id=?`,
      [b.faturaId || null, b.escolaId, b.valor, b.dataPagamento || now, b.formaPagamento || 'Mensal', b.metodoPagamento || 'Transferência', b.referencia || '', b.estado || 'Confirmado', b.observacoes || '', now, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM pagamentos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
