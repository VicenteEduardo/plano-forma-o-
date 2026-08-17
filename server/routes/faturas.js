const express = require('express');
const router = express.Router();
const { query, queryOne, getPool } = require('../db/database');

function mapFatura(r) {
  return {
    id: r.id, escolaId: r.escola_id, escolaNome: r.escola_nome || '',
    numero: r.numero, descricao: r.descricao || '',
    valorTotal: Number(r.valor_total), dataEmissao: r.data_emissao,
    dataVencimento: r.data_vencimento || '', estado: r.estado || 'Pendente',
    observacoes: r.observacoes || '', criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

router.get('/resumo', async (req, res, next) => {
  try {
    const total = await queryOne('SELECT COALESCE(SUM(valor_total),0) as total, COUNT(*) as cnt FROM faturas');
    const pendentes = await queryOne("SELECT COALESCE(SUM(valor_total),0) as total, COUNT(*) as cnt FROM faturas WHERE estado='Pendente'");
    const pagas = await queryOne("SELECT COALESCE(SUM(valor_total),0) as total, COUNT(*) as cnt FROM faturas WHERE estado='Pago'");
    const porEscola = await query(`
      SELECT e.nome, f.escola_id, SUM(f.valor_total) as total, COUNT(*) as cnt
      FROM faturas f LEFT JOIN escolas e ON e.id=f.escola_id
      GROUP BY f.escola_id, e.nome ORDER BY total DESC
    `);
    const porMes = await query(`
      SELECT SUBSTRING(data_emissao,1,7) as mes, SUM(valor_total) as total, COUNT(*) as cnt
      FROM faturas GROUP BY mes ORDER BY mes DESC
    `);
    res.json({
      total: Number(total?.total || 0), count: Number(total?.cnt || 0),
      pendentes: Number(pendentes?.total || 0), pendentesCount: Number(pendentes?.cnt || 0),
      pagas: Number(pagas?.total || 0), pagasCount: Number(pagas?.cnt || 0),
      porEscola: porEscola.map(r => ({ escolaId: r.escola_id, nome: r.nome || 'Sem escola', total: Number(r.total), count: r.cnt })),
      porMes: porMes.map(r => ({ mes: r.mes, total: Number(r.total), count: r.cnt })),
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    let sql = `SELECT f.*, e.nome as escola_nome
      FROM faturas f
      LEFT JOIN escolas e ON e.id = f.escola_id`;
    const params = [];
    const wheres = [];
    if (req.query.escola_id) { wheres.push('f.escola_id=?'); params.push(req.query.escola_id); }
    if (req.query.estado) { wheres.push('f.estado=?'); params.push(req.query.estado); }
    if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
    sql += ' ORDER BY f.data_emissao DESC, f.id DESC';
    const rows = await query(sql, params);
    res.json(Array.isArray(rows) ? rows.map(mapFatura) : []);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const r = await queryOne(
      `SELECT f.*, e.nome as escola_nome FROM faturas f LEFT JOIN escolas e ON e.id=f.escola_id WHERE f.id=?`,
      [req.params.id]
    );
    if (!r) return res.status(404).json({ error: 'Fatura não encontrada' });
    res.json(mapFatura(r));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.escolaId) return res.status(400).json({ error: 'Escola é obrigatória' });
    if (!b.numero) return res.status(400).json({ error: 'Número da fatura é obrigatório' });
    if (!b.valorTotal || Number(b.valorTotal) <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' });
    const now = new Date().toISOString().slice(0, 10);
    const [info] = await getPool().query(
      `INSERT INTO faturas (escola_id, numero, descricao, valor_total, data_emissao, data_vencimento, estado, observacoes, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [b.escolaId, b.numero, b.descricao || '', b.valorTotal, b.dataEmissao || now, b.dataVencimento || '', b.estado || 'Pendente', b.observacoes || '', now, now]
    );
    res.json({ id: info.insertId, escolaId: b.escolaId, numero: b.numero });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0, 10);
    await query(
      `UPDATE faturas SET escola_id=?, numero=?, descricao=?, valor_total=?, data_emissao=?, data_vencimento=?, estado=?, observacoes=?, atualizado_em=? WHERE id=?`,
      [b.escolaId, b.numero, b.descricao || '', b.valorTotal, b.dataEmissao || now, b.dataVencimento || '', b.estado || 'Pendente', b.observacoes || '', now, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM pagamentos WHERE fatura_id=?', [req.params.id]);
    await query('DELETE FROM faturas WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
