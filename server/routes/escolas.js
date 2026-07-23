const express = require('express');
const router = express.Router();
const { query, queryOne, getDb } = require('../db/database');

const EXTERNAL_API = 'https://admmnsvserver.eduall.site/institutes';

function normalizeEscola(item) {
  return {
    id: item.id,
    nome: item.name || '',
    codigo: item.code || '',
    email: item.email || '',
    telefone: item.phone || '',
    nif: item.nif || '',
    estado: item.state || '',
    diretor: item.principal || '',
    morada: item.address || '',
    tipo: item.type ?? 0,
    logo: item.logo || '',
  };
}

/* GET — fetch from EduAll external API, merge with local DB */
router.get('/', async (req, res, next) => {
  try {
    let external = [];
    try {
      const resp = await fetch(EXTERNAL_API, { signal: AbortSignal.timeout(15000) });
      if (resp.ok) {
        const raw = await resp.json();
        external = (Array.isArray(raw) ? raw : []).map(normalizeEscola);
      }
    } catch (_) { /* external API down — fallback */ }

    /* also load local DB schools so old references still resolve */
    const local = (await query('SELECT * FROM escolas ORDER BY nome')).map(r => ({
      id: r.id, nome: r.nome, codigo: r.codigo, email: '', telefone: '',
      nif: '', estado: '', diretor: '', morada: '', tipo: 0, logo: '',
    }));

    /* merge: external first, then local entries whose IDs don't clash */
    const seen = new Set(external.map(e => e.id));
    const merged = [...external];
    for (const loc of local) {
      if (!seen.has(loc.id)) {
        merged.push(loc);
        seen.add(loc.id);
      }
    }

    res.json(merged.length ? merged : local);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { nome, codigo } = req.body;
    if (!nome || !codigo) return res.status(400).json({ error: 'nome e codigo são obrigatórios' });
    const db = await getDb();
    try {
      const [info] = await db.execute('INSERT INTO escolas (nome, codigo) VALUES (?, ?)', [nome, codigo]);
      res.json({ id: info.insertId, nome, codigo });
    } finally { db.release(); }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nome, codigo } = req.body;
    await query('UPDATE escolas SET nome=?, codigo=? WHERE id=?', [nome, codigo, req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM escolas WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
