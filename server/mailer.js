const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const notifyEmails = (process.env.NOTIFY_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
  console.warn('[mail] AVISO: falta configuração de email no .env (MAIL_HOST/MAIL_USER/MAIL_PASSWORD). As notificações por email não serão enviadas.');
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 465),
    secure: process.env.MAIL_SECURE !== 'false',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });
}

const transporter = createTransporter();

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendMail(opts) {
  const to = [].concat(opts.to || []).filter(Boolean);
  if (!to.length) return { ok: false, error: 'Sem destinatários' };
  const from = opts.from || process.env.MAIL_FROM || '"Eduall Software" <noreply@eduall.site>';
  try {
    await transporter.sendMail({ from, to: to.join(', '), subject: opts.subject, text: opts.text, html: opts.html });
    console.log('[mail] enviado para', to.join(', '));
    return { ok: true, via: 'SMTP principal' };
  } catch (err) {
    console.error('[mail] erro ao enviar (SMTP principal):', err.message);
    if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
      try {
        const gmail = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASSWORD } });
        await gmail.sendMail({ from: process.env.GMAIL_USER, to: to.join(', '), subject: opts.subject, text: opts.text, html: opts.html });
        console.log('[mail] enviado via Gmail fallback para', to.join(', '));
        return { ok: true, via: 'Gmail fallback' };
      } catch (err2) {
        console.error('[mail] erro ao enviar (fallback Gmail):', err2.message);
        return { ok: false, error: `SMTP: ${err.message}; Gmail fallback: ${err2.message}`, via: 'nenhum' };
      }
    }
    return { ok: false, error: err.message, via: 'nenhum' };
  }
}

function notifyOcorrencia(info) {
  const to = [...new Set((info.to || []).concat(notifyEmails).filter(Boolean))];
  if (!to.length) return;
  const appUrl = process.env.APP_URL || process.env.APP_CLIENT_URL || 'https://reuniao.eduall.io/';
  const linhas = [];
  const add = (label, val) => { if (val) linhas.push(`<tr><td style="padding:4px 10px 4px 0;font-weight:600;white-space:nowrap;color:#334155;">${label}</td><td style="padding:4px 10px;color:#0f172a;">${val}</td></tr>`); };
  add('Ação', escHtml(info.acao));
  add('Título', escHtml(info.titulo));
  add('Estado', escHtml(info.estado));
  add('Prioridade', escHtml(info.prioridade));
  add('Gravidade', escHtml(info.gravidade));
  add('Escola / Cliente', escHtml(info.escola));
  add('Técnico', escHtml(info.tecnico));
  if (info.comentario) add('Comentário', escHtml(info.comentario));

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0f172a;color:#fff;padding:14px 20px;border-radius:8px 8px 0 0;font-size:15px;font-weight:700;">Eduall Software — ${escHtml(info.acao)}</div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:16px 20px;">
        <table style="border-collapse:collapse;font-size:13px;">${linhas.join('')}</table>
        ${info.descricao ? `<p style="font-size:13px;color:#334155;border-left:3px solid #94a3b8;padding-left:10px;margin-top:12px;">${escHtml(info.descricao)}</p>` : ''}
        ${appUrl ? `<p style="margin-top:16px;"><a href="${escHtml(appUrl)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:13px;">Abrir sistema</a></p>` : ''}
      </div>
    </div>`;
  const text = [
    `${info.acao}: ${info.titulo}`,
    info.estado && `Estado: ${info.estado}`,
    info.prioridade && `Prioridade: ${info.prioridade}`,
    info.gravidade && `Gravidade: ${info.gravidade}`,
    info.escola && `Escola / Cliente: ${info.escola}`,
    info.tecnico && `Técnico: ${info.tecnico}`,
    info.comentario && `Comentário: ${info.comentario}`,
    info.descricao && `Descrição: ${info.descricao}`,
    appUrl && `Sistema: ${appUrl}`,
  ].filter(Boolean).join('\n');

  sendMail({ to, subject: `${info.acao} — ${info.titulo}`, html, text });
}

module.exports = { sendMail, notifyOcorrencia, notifyEmails, escHtml };
