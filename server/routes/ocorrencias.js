const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, queryOne, getDb, getPool } = require('../db/database');

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

function mapOcor(r) {
  return {
    id: r.id, titulo: r.titulo, escolaId: r.escola_id, descricao: r.descricao,
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
      o.fotos = [];
      o.video = null;
    }
    res.json(rows);
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
    const [info] = await pool.query(
      'INSERT INTO ocorrencias (titulo, escola_id, descricao, tecnico_id, evento_id, prioridade, gravidade, estado, resolucao, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [b.titulo, b.escolaId||null, b.descricao, b.tecnicoId||null, b.eventoId||null,
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
    res.json({ id: ocorId, titulo: b.titulo, escolaId: b.escolaId, descricao: b.descricao,
      tecnicoId: b.tecnicoId, eventoId: b.eventoId, prioridade: b.prioridade, gravidade: b.gravidade,
      estado: b.estado, resolucao: b.resolucao, criadoEm: now, atualizadoEm: now });
  } catch (err) { console.error('Erro ao criar ocorrência:', err); next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const now = new Date().toISOString().slice(0,10);
    const pool = getPool();
    await pool.query(
      'UPDATE ocorrencias SET titulo=?, escola_id=?, descricao=?, tecnico_id=?, evento_id=?, prioridade=?, gravidade=?, estado=?, resolucao=?, atualizado_em=? WHERE id=?',
      [b.titulo, b.escolaId||null, b.descricao, b.tecnicoId||null, b.eventoId||null,
       b.prioridade||'Média', b.gravidade||'Moderada', b.estado||'Aberta', b.resolucao||'', now, req.params.id]
    );
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
    await pool.query('DELETE FROM ocorrencia_fotos WHERE ocorrencia_id=?', [req.params.id]);
    await pool.query('DELETE FROM ocorrencia_videos WHERE ocorrencia_id=?', [req.params.id]);
    await pool.query('DELETE FROM ocorrencias WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
