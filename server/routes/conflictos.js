const express = require('express');
const router = express.Router();
const { query } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    const { tecnico_id, data, hora_inicio, hora_fim, excluir_evento_id } = req.query;

    if (!tecnico_id || !data) {
      return res.status(400).json({ error: 'tecnico_id e data são obrigatórios' });
    }

    const techIds = tecnico_id.split(',').map(Number).filter(Boolean);
    const conflitos = [];

    for (const tid of techIds) {
      let evtSql = "SELECT * FROM eventos WHERE (tecnico_id=? OR evento_id IN (SELECT evento_id FROM evento_tecnicos WHERE tecnico_id=?)) AND data=? AND estado != 'Cancelado'";
      let evtParams = [tid, tid, data];

      if (excluir_evento_id) {
        evtSql += ' AND id != ?';
        evtParams.push(excluir_evento_id);
      }

      const eventos = await query(evtSql, evtParams);

      if (hora_inicio && hora_fim) {
        for (const evt of eventos) {
          if (hora_inicio < evt.hora_fim && hora_fim > evt.hora_inicio) {
            conflitos.push({ tipo: 'evento', tecnicoId: tid, id: evt.id, titulo: evt.titulo, horaInicio: evt.hora_inicio, horaFim: evt.hora_fim, estado: evt.estado });
          }
        }
      } else {
        for (const evt of eventos) {
          conflitos.push({ tipo: 'evento', tecnicoId: tid, id: evt.id, titulo: evt.titulo, horaInicio: evt.hora_inicio, horaFim: evt.hora_fim, estado: evt.estado });
        }
      }

      const ausencias = await query("SELECT * FROM ausencias WHERE tecnico_id=? AND estado='Aprovado' AND inicio<=? AND fim>=?", [tid, data, data]);
      for (const aus of ausencias) {
        conflitos.push({ tipo: 'ausencia', tecnicoId: tid, id: aus.id, tipoAusencia: aus.tipo, meioDia: !!aus.meio_dia, inicio: aus.inicio, fim: aus.fim });
      }

      const tech = (await query('SELECT estado FROM tecnicos WHERE id=?', [tid]))[0];
      if (tech && (tech.estado === 'Férias' || tech.estado === 'Inativo')) {
        conflitos.push({ tipo: 'estado', tecnicoId: tid, estado: tech.estado });
      }
    }

    res.json({ conflitos, temConflito: conflitos.length > 0 });
  } catch (err) { next(err); }
});

module.exports = router;
