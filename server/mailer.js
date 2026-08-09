const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const mailConfig = {
  host: process.env.MAIL_HOST || 'smtp.etic.co.ao',
  port: Number(process.env.MAIL_PORT || 587),
  secure: process.env.MAIL_SECURE ? process.env.MAIL_SECURE === 'true' : false,
  user: process.env.MAIL_USER || 'dev.teste@etic.co.ao',
  pass: process.env.MAIL_PASSWORD || 'Root!12345',
  from: process.env.MAIL_FROM || '"Eduall Software" <dev.teste@etic.co.ao>',
};

const notifyEmails = (process.env.NOTIFY_EMAILS || 'vicentemanueleduardo@gmail.com,kiossocamuegi@gmail.com')
  .split(',').map(e => e.trim()).filter(Boolean);

function createTransporter() {
  return nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass,
    },
  });
}

const transporter = createTransporter();

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const RICH_CSS = {
  h1: 'font-size:22px;font-weight:700;color:#1f2937;line-height:1.35;margin:16px 0 8px;',
  h2: 'font-size:18px;font-weight:700;color:#1f2937;line-height:1.35;margin:16px 0 8px;',
  h3: 'font-size:16px;font-weight:700;color:#1f2937;line-height:1.35;margin:14px 0 6px;',
  h4: 'font-size:15px;font-weight:700;color:#1f2937;line-height:1.35;margin:14px 0 6px;',
  h5: 'font-size:14px;font-weight:700;color:#1f2937;line-height:1.35;margin:12px 0 6px;',
  h6: 'font-size:13px;font-weight:700;color:#1f2937;line-height:1.35;margin:12px 0 6px;',
  p: 'margin:0 0 10px;color:#4b5563;font-size:14.5px;line-height:1.7;',
  ul: 'margin:0 0 12px;padding-left:20px;color:#4b5563;font-size:14.5px;line-height:1.7;',
  ol: 'margin:0 0 12px;padding-left:20px;color:#4b5563;font-size:14.5px;line-height:1.7;',
  li: 'margin:0 0 5px;',
  blockquote: 'margin:0 0 10px;padding:8px 12px;border-left:3px solid #7c3aed;background:#f9fafb;color:#4b5563;font-size:14.5px;line-height:1.7;',
};

function sanitizeRich(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function injectInlineStyles(html, rules) {
  return Object.entries(rules).reduce((acc, [tag, css]) => {
    const re = new RegExp('<' + tag + '(?![^>]*style\\s*=)([^>]*?)(/?)>', 'gi');
    return acc.replace(re, '<' + tag + '$1 style="' + css + '"$2>');
  }, html);
}

function renderRich(html) {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return escHtml(html).replace(/\n/g, '<br>');
  return injectInlineStyles(sanitizeRich(html), RICH_CSS);
}

async function sendMail(opts) {
  const to = [].concat(opts.to || []).filter(Boolean);
  if (!to.length) return { ok: false, error: 'Sem destinatários' };
  const from = opts.from || mailConfig.from;
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

const MAIL_LOGO = 'https://ik.imagekit.io/zks5iegia/image-gen__56___1_-removebg-preview.png?updatedAt=1772698800311';

function notifyOcorrencia(info) {
  const to = [...new Set((info.to || []).concat(notifyEmails).filter(Boolean))];
  if (!to.length) return;
  const appUrl = process.env.APP_URL || process.env.APP_CLIENT_URL || 'https://reuniao.eduall.io/';
  const year = new Date().getFullYear();

  const detalhes = [];
  const add = (label, val) => { if (val) detalhes.push(`
      <div style="margin-bottom:15px;">
        <div style="color:#7c3aed;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">${label}</div>
        <div style="color:#1f2937;font-size:14px;font-weight:500;">${val}</div>
      </div>`); };
  add('Ação', escHtml(info.acao));
  add('Título', escHtml(info.titulo));
  add('Estado', escHtml(info.estado));
  add('Prioridade', escHtml(info.prioridade));
  add('Gravidade', escHtml(info.gravidade));
  add('Escola / Cliente', escHtml(info.escola));
  add('Técnico', escHtml(info.tecnico));
  if (info.comentario) add('Comentário', escHtml(info.comentario));

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:40px 20px;min-height:100vh;width:100%;">
      <div style="max-width:600px;margin:0 auto;position:relative;">
        <div style="background:#ffffff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;position:relative;">
          <div style="background:#1f2937;padding:30px 20px;text-align:center;">
            <img src="${MAIL_LOGO}" alt="Eduall" style="height:60px;width:auto;display:inline-block;">
          </div>
          <div style="padding:40px 30px;text-align:center;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 15px;">
              <path d="M7 18C6.45 18 6 18.45 6 19C6 19.55 6.45 20 7 20H17C17.55 20 18 19.55 18 19C18 18.45 17.55 18 17 18H7ZM3 6V14H3.58C3.2 14.78 3 15.66 3 16.5C3 18.45 4.21 20.12 5.88 20.88C6.55 20.96 7.25 21 8 21H16C16.75 21 17.45 20.96 18.12 20.88C19.79 20.12 21 18.45 21 16.5C21 15.66 20.8 14.78 20.42 14H21V6C21 4.9 20.1 4 19 4H5C3.9 4 3 4.9 3 6ZM5 6H19V12H5V6Z" fill="#7c3aed"/>
            </svg>
            <div style="color:#1f2937;font-size:28px;font-weight:700;margin-bottom:8px;line-height:1.2;">${escHtml(info.acao)}</div>
            <div style="color:#7c3aed;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;">Ocorrências · Sistema Eduall</div>
            <p style="color:#4b5563;font-size:15px;line-height:1.8;margin-bottom:12px;">Olá,<br>Foi registada uma ocorrência na plataforma. Aceda ao portal para visualizar os detalhes e acompanhar a resolução.</p>
            <div style="text-align:left;background:#f9fafb;border-radius:8px;margin:25px 0;overflow:hidden;">
              <div style="background:#1f2937;color:#ffffff;padding:12px 20px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">Detalhes da Ocorrência</div>
              <div style="padding:20px;">${detalhes.join('')}${info.descricao ? `
                <div>
                  <div style="color:#7c3aed;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Descrição</div>
                  <div style="color:#1f2937;font-size:14px;font-weight:500;overflow-wrap:anywhere;">${renderRich(info.descricao)}</div>
                </div>` : ''}</div>
            </div>
            <p style="color:#4b5563;font-size:15px;line-height:1.8;margin-bottom:12px;">Aceda ao portal para adicionar comentários, anexar fotos ou atualizar o estado da ocorrência.</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${escHtml(appUrl)}" style="display:inline-block;background:linear-gradient(135deg,#ec4899 0%,#db2777 100%);color:#ffffff;padding:14px 50px;border-radius:25px;text-decoration:none;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px;box-shadow:0 8px 20px rgba(236,72,153,.3);">Visualizar Ocorrência</a>
            </div>
            <div style="color:#9ca3af;font-size:12px;margin-top:20px;line-height:1.6;word-break:break-all;">Para acompanhar a ocorrência, aceda ao link abaixo:<br><strong style="color:#7c3aed;">${escHtml(appUrl)}</strong></div>
          </div>
          <div style="background:linear-gradient(180deg,#7c3aed 0%,#6d28d9 100%);padding:30px;text-align:center;color:#ffffff;">
            <div style="font-weight:700;font-size:16px;margin-bottom:5px;letter-spacing:1px;">EDUALL</div>
            <div style="color:rgba(255,255,255,.8);font-size:13px;margin-bottom:20px;">Plataforma de Gestão Escolar Integrada</div>
            <div style="margin:20px 0;display:flex;justify-content:center;gap:12px;">
              <a href="#" style="width:36px;height:36px;background:#1f2937;border-radius:50%;display:inline-block;line-height:36px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">f</a>
              <a href="#" style="width:36px;height:36px;background:#1f2937;border-radius:50%;display:inline-block;line-height:36px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">𝕏</a>
              <a href="#" style="width:36px;height:36px;background:#1f2937;border-radius:50%;display:inline-block;line-height:36px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">in</a>
              <a href="#" style="width:36px;height:36px;background:#1f2937;border-radius:50%;display:inline-block;line-height:36px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">Li</a>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,.2);margin:20px 0;"></div>
            <div style="margin:15px 0;font-size:12px;">
              <a href="#" style="color:rgba(255,255,255,.9);text-decoration:none;margin:0 10px;">Privacidade</a>
              <a href="#" style="color:rgba(255,255,255,.9);text-decoration:none;margin:0 10px;">Termos</a>
              <a href="#" style="color:rgba(255,255,255,.9);text-decoration:none;margin:0 10px;">Suporte</a>
            </div>
            <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:15px;line-height:1.5;">© ${year} Eduall Software. Todos os direitos reservados.<br>Esta mensagem foi enviada para <strong>${escHtml(to.join(', '))}</strong></div>
          </div>
        </div>
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

module.exports = { sendMail, notifyOcorrencia, notifyEmails, mailConfig, escHtml, renderRich };
