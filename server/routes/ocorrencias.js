const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne, getDb, getPool } = require('../db/database');
const { notifyOcorrencia } = require('../mailer');

async function ocorrenciaInfo(ocorId) {
  return queryOne(
    `SELECT o.codigo, o.titulo, o.tipo, o.descricao, o.estado, o.prioridade, o.gravidade, o.escola_id, o.tecnico_id,
            t.nome AS tecnico_nome, t.email AS tecnico_email, e.nome AS escola_nome
     FROM ocorrencias o
     LEFT JOIN tecnicos t ON t.id = o.tecnico_id
     LEFT JOIN escolas e ON e.id = o.escola_id
     WHERE o.id=?`, [ocorId]);
}

function notifyOcor(acao, ocorId, extra) {
  ocorrenciaInfo(ocorId).then(row => {
    if (!row) return;
    const to = row.tecnico_email ? [row.tecnico_email] : [];
    notifyOcorrencia({
      acao, codigo: row.codigo, titulo: row.titulo, tipo: row.tipo, descricao: row.descricao, estado: row.estado,
      prioridade: row.prioridade, gravidade: row.gravidade,
      escola: row.escola_nome, tecnico: row.tecnico_nome,
      comentario: extra ? extra.comentario : null, to,
    });
  }).catch(err => console.error('Erro notificação email:', err.message));
}

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'ocorrencias');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'ocr_' + Date.now() + '_' + Math.round(Math.random() * 1e6) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

function nowStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function mapOcor(r) {
  return {
    id: r.id, codigo: r.codigo, titulo: r.titulo, tipo: r.tipo, escolaId: r.escola_id, descricao: r.descricao,
    tecnicoId: r.tecnico_id, eventoId: r.evento_id, prioridade: r.prioridade,
    gravidade: r.gravidade, estado: r.estado, resolucao: r.resolucao,
    criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = (await query('SELECT * FROM ocorrencias ORDER BY atualizado_em DESC')).map(mapOcor);
    for (const o of rows) {
      const fotoCount = await queryOne('SELECT COUNT(*) as cnt FROM ocorrencia_fotos WHERE ocorrencia_id=?', [o.id]);
      o.fotosCount = fotoCount ? fotoCount.cnt : 0;
      const vidCount = await queryOne('SELECT COUNT(*) as cnt FROM ocorrencia_videos WHERE ocorrencia_id=?', [o.id]);
      o.hasVideo = vidCount ? vidCount.cnt > 0 : false;
      const cmtCount = await queryOne('SELECT COUNT(*) as cnt FROM ocorrencia_comentarios WHERE ocorrencia_id=?', [o.id]);
      o.comentariosCount = cmtCount ? cmtCount.cnt : 0;
      o.fotos = [];
      o.video = null;
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id/comentarios', async (req, res, next) => {
  try {
    const r = await queryOne('SELECT id FROM ocorrencias WHERE id=?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const rows = await query('SELECT * FROM ocorrencia_comentarios WHERE ocorrencia_id=? ORDER BY criado_em ASC, id ASC', [req.params.id]);
    res.json(rows.map(c => ({
      id: c.id, ocorrenciaId: c.ocorrencia_id, comentario: c.comentario,
      tecnicoId: c.tecnico_id, criadoEm: c.criado_em
    })));
  } catch (err) { next(err); }
});

router.post('/:id/comentarios', async (req, res, next) => {
  try {
    const r = await queryOne('SELECT id FROM ocorrencias WHERE id=?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const texto = (req.body.comentario || '').trim();
    if (!texto) return res.status(400).json({ error: 'comentario é obrigatório' });
    const now = nowStr();
    const pool = getPool();
    const [info] = await pool.query(
      'INSERT INTO ocorrencia_comentarios (ocorrencia_id, comentario, tecnico_id, criado_em) VALUES (?,?,?,?)',
      [req.params.id, texto, req.body.tecnicoId || null, now]
    );
    await pool.query('UPDATE ocorrencias SET atualizado_em=? WHERE id=?', [now.slice(0,10), req.params.id]);
    res.json({ id: info.insertId, ocorrenciaId: Number(req.params.id), comentario: texto, tecnicoId: req.body.tecnicoId || null, criadoEm: now });
    notifyOcor('Novo comentário na ocorrência', Number(req.params.id), { comentario: texto });
  } catch (err) { next(err); }
});

router.delete('/:id/comentarios/:comentarioId', async (req, res, next) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM ocorrencia_comentarios WHERE id=? AND ocorrencia_id=?', [req.params.comentarioId, req.params.id]);
    res.json({ ok: true });
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
    const cmtCount = await queryOne('SELECT COUNT(*) as cnt FROM ocorrencia_comentarios WHERE ocorrencia_id=?', [o.id]);
    o.comentariosCount = cmtCount ? cmtCount.cnt : 0;
    o.fotosCount = o.fotos.length;
    o.hasVideo = !!o.video;
    res.json(o);
  } catch (err) { next(err); }
});

router.get('/:id/media', async (req, res, next) => {
  try {
    const r = await queryOne('SELECT id FROM ocorrencias WHERE id=?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const fotos = (await query('SELECT dados FROM ocorrencia_fotos WHERE ocorrencia_id=?', [req.params.id])).map(f => f.dados);
    const vid = await queryOne('SELECT dados FROM ocorrencia_videos WHERE ocorrencia_id=?', [req.params.id]);
    res.json({ fotos, video: vid ? vid.dados : null });
  } catch (err) { next(err); }
});

router.post('/:id/fotos', upload.array('fotos', 10), async (req, res, next) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'Nenhum ficheiro enviado' });
    const ocorId = req.params.id;
    const urls = req.files.map(f => '/uploads/ocorrencias/' + f.filename);
    for (const u of urls) {
      await query('INSERT INTO ocorrencia_fotos (ocorrencia_id, dados) VALUES (?,?)', [ocorId, u]);
    }
    res.json({ ok: true, urls });
  } catch (err) { next(err); }
});

router.post('/:id/video', upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum ficheiro enviado' });
    const url = '/uploads/ocorrencias/' + req.file.filename;
    await query('INSERT INTO ocorrencia_videos (ocorrencia_id, dados) VALUES (?,?)', [req.params.id, url]);
    res.json({ ok: true, url });
  } catch (err) { next(err); }
});

router.delete('/:id/foto/:fotoId', async (req, res, next) => {
  try {
    const row = await queryOne('SELECT dados FROM ocorrencia_fotos WHERE id=? AND ocorrencia_id=?', [req.params.fotoId, req.params.id]);
    if (row && row.dados && row.dados.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', '..', 'public', row.dados);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query('DELETE FROM ocorrencia_fotos WHERE id=? AND ocorrencia_id=?', [req.params.fotoId, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id/video/:videoId', async (req, res, next) => {
  try {
    const row = await queryOne('SELECT dados FROM ocorrencia_videos WHERE id=? AND ocorrencia_id=?', [req.params.videoId, req.params.id]);
    if (row && row.dados && row.dados.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '..', '..', 'public', row.dados);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query('DELETE FROM ocorrencia_videos WHERE id=? AND ocorrencia_id=?', [req.params.videoId, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    if (!b.titulo || !b.descricao) return res.status(400).json({ error: 'titulo e descricao são obrigatórios' });
    const pool = getPool();
    const [maxRow] = await pool.query('SELECT id FROM ocorrencias ORDER BY id DESC LIMIT 1');
    const nextNum = maxRow.length ? maxRow[0].id + 1 : 1;
    const codigo = 'OCR-' + String(nextNum).padStart(4, '0');
    const [info] = await pool.query(
      'INSERT INTO ocorrencias (codigo, titulo, tipo, escola_id, descricao, tecnico_id, evento_id, prioridade, gravidade, estado, resolucao, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [codigo, b.titulo, b.tipo||'Erro', b.escolaId||null, b.descricao, b.tecnicoId||null, b.eventoId||null,
       b.prioridade||'Média', b.gravidade||'Moderada', b.estado||'Aberta', b.resolucao||'', now, now]
    );
    const ocorId = info.insertId;
    if (b.fotos && b.fotos.length) {
      for (const f of b.fotos) {
        await pool.query('INSERT INTO ocorrencia_fotos (ocorrencia_id, dados) VALUES (?,?)', [ocorId, f]);
      }
    }
    if (b.video) {
      await pool.query('INSERT INTO ocorrencia_videos (ocorrencia_id, dados) VALUES (?,?)', [ocorId, b.video]);
    }
    if ((b.comentario || '').trim()) {
      await pool.query('INSERT INTO ocorrencia_comentarios (ocorrencia_id, comentario, tecnico_id, criado_em) VALUES (?,?,?,?)',
        [ocorId, b.comentario.trim(), b.comentarioTecnicoId || null, nowStr()]);
    }
    res.json({ id: ocorId, codigo, titulo: b.titulo, tipo: b.tipo||'Erro', escolaId: b.escolaId, descricao: b.descricao,
      tecnicoId: b.tecnicoId, eventoId: b.eventoId, prioridade: b.prioridade, gravidade: b.gravidade,
      estado: b.estado, resolucao: b.resolucao, comentariosCount: b.comentario ? 1 : 0,
      criadoEm: now, atualizadoEm: now });
    notifyOcor('Nova ocorrência aberta', ocorId);
  } catch (err) { console.error('Erro ao criar ocorrência:', err); next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    const pool = getPool();
    await pool.query(
      'UPDATE ocorrencias SET titulo=?, tipo=?, escola_id=?, descricao=?, tecnico_id=?, evento_id=?, prioridade=?, gravidade=?, estado=?, resolucao=?, atualizado_em=? WHERE id=?',
      [b.titulo, b.tipo||'Erro', b.escolaId||null, b.descricao, b.tecnicoId||null, b.eventoId||null,
       b.prioridade||'Média', b.gravidade||'Moderada', b.estado||'Aberta', b.resolucao||'', now, req.params.id]
    );
    if ((b.comentario || '').trim()) {
      await pool.query('INSERT INTO ocorrencia_comentarios (ocorrencia_id, comentario, tecnico_id, criado_em) VALUES (?,?,?,?)',
        [req.params.id, b.comentario.trim(), b.comentarioTecnicoId || null, nowStr()]);
    }
    if (b.deleteFotos && b.deleteFotos.length) {
      for (const fid of b.deleteFotos) {
        const row = await queryOne('SELECT dados FROM ocorrencia_fotos WHERE id=? AND ocorrencia_id=?', [fid, req.params.id]);
        if (row && row.dados && row.dados.startsWith('/uploads/')) {
          const filePath = path.join(__dirname, '..', '..', 'public', row.dados);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await pool.query('DELETE FROM ocorrencia_fotos WHERE id=? AND ocorrencia_id=?', [fid, req.params.id]);
      }
    }
    if (b.deleteVideo) {
      const row = await queryOne('SELECT dados FROM ocorrencia_videos WHERE id=? AND ocorrencia_id=?', [b.deleteVideo, req.params.id]);
      if (row && row.dados && row.dados.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', '..', 'public', row.dados);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      await pool.query('DELETE FROM ocorrencia_videos WHERE id=? AND ocorrencia_id=?', [b.deleteVideo, req.params.id]);
    }
    res.json({ ok: true });
    notifyOcor('Ocorrência atualizada', Number(req.params.id));
  } catch (err) { console.error('Erro ao atualizar ocorrência:', err); next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const pool = getPool();
    const fotos = await query('SELECT id, dados FROM ocorrencia_fotos WHERE ocorrencia_id=?', [req.params.id]);
    for (const f of fotos) {
      if (f.dados && f.dados.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', '..', 'public', f.dados);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    const vids = await query('SELECT id, dados FROM ocorrencia_videos WHERE ocorrencia_id=?', [req.params.id]);
    for (const v of vids) {
      if (v.dados && v.dados.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', '..', 'public', v.dados);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    await pool.query('DELETE FROM ocorrencia_comentarios WHERE ocorrencia_id=?', [req.params.id]);
    await pool.query('DELETE FROM ocorrencia_fotos WHERE ocorrencia_id=?', [req.params.id]);
    await pool.query('DELETE FROM ocorrencia_videos WHERE ocorrencia_id=?', [req.params.id]);
    await pool.query('DELETE FROM ocorrencias WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
