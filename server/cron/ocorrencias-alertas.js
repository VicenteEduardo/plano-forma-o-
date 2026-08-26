const cron = require('node-cron');
const { query } = require('../db/database');
const { sendMail, notifyEmails, escHtml } = require('../mailer');

const DIAS_ABERTA = 3;
const DIAS_ANALISE = 5;
const CRON_EXPR = '0 9 * * *';

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function buildAlertHtml(ocorrencias) {
  const MAIL_LOGO = 'https://ik.imagekit.io/zks5iegia/image-gen__56___1_-removebg-preview.png?updatedAt=1772698800311';
  const appUrl = process.env.APP_URL || process.env.APP_CLIENT_URL || 'https://reuniao.eduall.io/';
  const year = new Date().getFullYear();

  const rows = ocorrencias.map(o => {
    const cor = o.diasAbertos > (o.estado === 'Em análise' ? DIAS_ANALISE : DIAS_ABERTA) + 2 ? '#dc2626' : '#f59e0b';
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px 16px;font-weight:600;color:#7c3aed;font-size:13px;white-space:nowrap;">${escHtml(o.codigo)}</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:13px;">${escHtml(o.titulo)}</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:13px;">${escHtml(o.escola || '—')}</td>
        <td style="padding:12px 16px;"><span style="background:${o.estado === 'Aberta' ? '#fef2f2;color:#dc2626' : '#fffbeb;color:#d97706'};padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">${escHtml(o.estado)}</span></td>
        <td style="padding:12px 16px;font-weight:700;color:${cor};font-size:13px;">${o.diasAbertos} dias</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:13px;">${escHtml(o.tecnico || 'Não atribuído')}</td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:40px 20px;min-height:100vh;width:100%;">
      <div style="max-width:750px;margin:0 auto;position:relative;">
        <div style="background:#ffffff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;">
          <div style="background:#1f2937;padding:30px 20px;text-align:center;">
            <img src="${MAIL_LOGO}" alt="Eduall" style="height:60px;width:auto;display:inline-block;">
          </div>
          <div style="padding:40px 30px;">
            <div style="text-align:center;margin-bottom:30px;">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 15px;">
                <path d="M1 21H23L12 2L1 21ZM13 18H11V16H13V18ZM13 14H11V10H13V14Z" fill="#f59e0b"/>
              </svg>
              <div style="color:#1f2937;font-size:24px;font-weight:700;margin-bottom:6px;">Alerta: Ocorrências Pendentes</div>
              <div style="color:#7c3aed;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${ocorrencias.length} ocorrência${ocorrencias.length !== 1 ? 's' : ''} aguarda${ocorrencias.length === 1 ? '' : 'm'} resolução</div>
            </div>
            <p style="color:#4b5563;font-size:14px;line-height:1.8;margin-bottom:20px;text-align:center;">
              As seguintes ocorrências estão abertas ou em análise há mais tempo que o permitido.<br>
              Por favor, atualizem o estado ou adicionem um comentário para resolução.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
              <thead>
                <tr style="background:#1f2937;">
                  <th style="padding:12px 16px;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Código</th>
                  <th style="padding:12px 16px;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Título</th>
                  <th style="padding:12px 16px;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Escola</th>
                  <th style="padding:12px 16px;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Estado</th>
                  <th style="padding:12px 16px;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Tempo</th>
                  <th style="padding:12px 16px;color:#ffffff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Técnico</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="text-align:center;margin:30px 0;">
              <a href="${escHtml(appUrl)}" style="display:inline-block;background:linear-gradient(135deg,#ec4899 0%,#db2777 100%);color:#ffffff;padding:14px 50px;border-radius:25px;text-decoration:none;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px;box-shadow:0 8px 20px rgba(236,72,153,.3);">Aceder ao Portal</a>
            </div>
          </div>
          <div style="background:linear-gradient(180deg,#7c3aed 0%,#6d28d9 100%);padding:25px;text-align:center;color:#ffffff;">
            <div style="font-weight:700;font-size:14px;letter-spacing:1px;">EDUALL</div>
            <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:8px;">© ${year} Eduall Software — Alertas Automáticos</div>
          </div>
        </div>
      </div>
    </div>`;
}

async function verificarOcorrenciasPendentes() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const abertas = await query(
      `SELECT o.*, t.nome AS tecnico_nome, t.email AS tecnico_email, e.nome AS escola_nome
       FROM ocorrencias o
       LEFT JOIN tecnicos t ON t.id = o.tecnico_id
       LEFT JOIN escolas e ON e.id = o.escola_id
       WHERE o.estado = 'Aberta'
         AND DATEDIFF(?, o.criado_em) > ?
         AND (o.alertado_em IS NULL OR o.alertado_em != ?)`,
      [today, DIAS_ABERTA, today]
    );

    const emAnalise = await query(
      `SELECT o.*, t.nome AS tecnico_nome, t.email AS tecnico_email, e.nome AS escola_nome
       FROM ocorrencias o
       LEFT JOIN tecnicos t ON t.id = o.tecnico_id
       LEFT JOIN escolas e ON e.id = o.escola_id
       WHERE o.estado = 'Em análise'
         AND DATEDIFF(?, o.atualizado_em) > ?
         AND (o.alertado_em IS NULL OR o.alertado_em != ?)`,
      [today, DIAS_ANALISE, today]
    );

    const all = [...abertas, ...emAnalise];
    if (!all.length) {
      console.log('[cron] Nenhuma ocorrência pendente para alertar.');
      return;
    }

    const mapped = all.map(o => ({
      id: o.id,
      codigo: o.codigo || 'OCR-' + String(o.id).padStart(4, '0'),
      titulo: o.titulo,
      estado: o.estado,
      escola: o.escola_nome,
      tecnico: o.tecnico_nome,
      tecnicoEmail: o.tecnico_email,
      diasAbertos: daysSince(o.estado === 'Aberta' ? o.criado_em : o.atualizado_em),
    }));

    const techEmails = [...new Set(mapped.map(o => o.tecnicoEmail).filter(Boolean))];
    const to = [...new Set([...techEmails, ...notifyEmails])];

    const html = buildAlertHtml(mapped);
    const text = mapped.map(o =>
      `${o.codigo} | ${o.titulo} | ${o.estado} | ${o.diasAbertos} dias | ${o.tecnico || 'Sem técnico'}`
    ).join('\n');

    await sendMail({
      to,
      subject: `[Alerta] ${mapped.length} ocorrência${mapped.length !== 1 ? 's' : ''} pendente${mapped.length !== 1 ? 's' : ''} há mais de ${mapped.length === 1 ? (mapped[0].estado === 'Em análise' ? DIAS_ANALISE : DIAS_ABERTA) + ' dias' : 'o prazo'}`,
      html,
      text: `Ocorrências pendentes:\n${text}`,
    });

    const ids = all.map(o => o.id);
    const placeholders = ids.map(() => '?').join(',');
    const pool = require('../db/database').getPool();
    await pool.query(`UPDATE ocorrencias SET alertado_em = ? WHERE id IN (${placeholders})`, [today, ...ids]);

    console.log(`[cron] Alerta enviado: ${mapped.length} ocorrência(s) pendente(s) para ${to.length} destinatário(s).`);
  } catch (err) {
    console.error('[cron] Erro ao verificar ocorrências pendentes:', err.message);
  }
}

function startOcorrenciasAlertas() {
  cron.schedule(CRON_EXPR, () => {
    console.log('[cron] A verificar ocorrências pendentes...');
    verificarOcorrenciasPendentes();
  });
  console.log('[cron] Alertas de ocorrências pendentes agendados (diário 09:00).');
}

module.exports = { startOcorrenciasAlertas, verificarOcorrenciasPendentes };
