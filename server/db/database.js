const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'u101094084_reuniao',
  password: '6HpX|B8d;',
  database: 'u101094084_reuniao',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  socketPath: undefined,
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

async function getDb() {
  return getPool().getConnection();
}

async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return Array.isArray(rows) ? rows : [];
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function initSchema() {
  const db = await getDb();
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS escolas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      codigo VARCHAR(50) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS tecnicos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL DEFAULT '',
      telefone VARCHAR(50) NOT NULL DEFAULT '',
      area VARCHAR(255) NOT NULL DEFAULT '',
      equipa VARCHAR(255) NOT NULL DEFAULT '',
      estado VARCHAR(50) NOT NULL DEFAULT 'Disponivel',
      hora_inicio VARCHAR(10) NOT NULL DEFAULT '08:00',
      hora_fim VARCHAR(10) NOT NULL DEFAULT '17:00',
      foto VARCHAR(500) NOT NULL DEFAULT ''
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    try {
      await db.execute(`ALTER TABLE tecnicos ADD COLUMN foto VARCHAR(500) NOT NULL DEFAULT ''`);
    } catch (_) { /* column already exists */ }

    await db.execute(`CREATE TABLE IF NOT EXISTS eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      data VARCHAR(10) NOT NULL,
      hora_inicio VARCHAR(10) NOT NULL,
      hora_fim VARCHAR(10) NOT NULL,
      tecnico_id INT,
      escola_id INT,
      local VARCHAR(255) NOT NULL DEFAULT '',
      prioridade VARCHAR(20) NOT NULL DEFAULT 'Media',
      estado VARCHAR(30) NOT NULL DEFAULT 'Agendado',
      tipo VARCHAR(50) NOT NULL DEFAULT 'Outros',
      responsavel VARCHAR(50) NOT NULL DEFAULT 'Tecnico',
      observacoes TEXT,
      INDEX idx_evt_tecnico (tecnico_id),
      INDEX idx_evt_data (data)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS evento_tecnicos (
      evento_id INT,
      tecnico_id INT,
      PRIMARY KEY (evento_id, tecnico_id),
      INDEX idx_et_tecnico (tecnico_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS ausencias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tecnico_id INT,
      tipo VARCHAR(50) NOT NULL,
      inicio VARCHAR(10) NOT NULL,
      fim VARCHAR(10) NOT NULL,
      meio_dia TINYINT NOT NULL DEFAULT 0,
      motivo VARCHAR(255) NOT NULL DEFAULT '',
      observacoes TEXT,
      estado VARCHAR(20) NOT NULL DEFAULT 'Pendente',
      INDEX idx_aus_tecnico (tecnico_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS reunioes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      escola_id INT,
      data VARCHAR(10) NOT NULL,
      hora_inicio VARCHAR(10) NOT NULL,
      hora_fim VARCHAR(10) NOT NULL,
      estado VARCHAR(30) NOT NULL DEFAULT 'Pendente',
      direcao_escola VARCHAR(255) NOT NULL DEFAULT '',
      direcao_eduall VARCHAR(255) NOT NULL DEFAULT '',
      administracao_eduall VARCHAR(255) NOT NULL DEFAULT '',
      tecnico_id INT,
      outros_participantes VARCHAR(500) NOT NULL DEFAULT '',
      objetivos TEXT,
      assuntos TEXT,
      descricao TEXT,
      decisoes TEXT,
      notas TEXT,
      proximos_passos TEXT,
      criado_em VARCHAR(10) NOT NULL,
      atualizado_em VARCHAR(10) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS reuniao_historico (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reuniao_id INT,
      data VARCHAR(10) NOT NULL,
      acao VARCHAR(255) NOT NULL,
      INDEX idx_rh_reuniao (reuniao_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS planos_formacao (
      id INT AUTO_INCREMENT PRIMARY KEY,
      escola_id INT,
      titulo VARCHAR(255) NOT NULL DEFAULT '',
      responsavel_id INT,
      versao VARCHAR(20) NOT NULL DEFAULT 'v1.0',
      estado VARCHAR(30) NOT NULL DEFAULT 'Rascunho',
      observacoes TEXT,
      criado_em VARCHAR(10) NOT NULL,
      atualizado_em VARCHAR(10) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS plano_participantes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      plano_id INT,
      nome VARCHAR(255) NOT NULL DEFAULT '',
      cargo VARCHAR(255) NOT NULL DEFAULT '',
      email VARCHAR(255) NOT NULL DEFAULT '',
      telefone VARCHAR(50) NOT NULL DEFAULT '',
      instituicao VARCHAR(255) NOT NULL DEFAULT '',
      INDEX idx_pp_plano (plano_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS plano_linhas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      plano_id INT,
      dia VARCHAR(50) NOT NULL DEFAULT '',
      data VARCHAR(10) NOT NULL,
      hora VARCHAR(10) NOT NULL DEFAULT '08:00',
      duracao VARCHAR(20) NOT NULL DEFAULT '2h',
      objetivo VARCHAR(500) NOT NULL DEFAULT '',
      tecnico_id INT,
      INDEX idx_pl_plano (plano_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS acessos_escolas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      escola_id INT,
      username VARCHAR(255) NOT NULL DEFAULT '',
      password VARCHAR(255) NOT NULL DEFAULT '',
      tipo_acesso VARCHAR(255) NOT NULL DEFAULT '',
      observacoes TEXT,
      criado_em VARCHAR(10) NOT NULL,
      atualizado_em VARCHAR(10) NOT NULL,
      INDEX idx_ae_escola (escola_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS notas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT,
      imagem LONGTEXT,
      criado_em VARCHAR(10) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS ocorrencias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      escola_id INT,
      descricao TEXT NOT NULL,
      tecnico_id INT,
      evento_id INT,
      prioridade VARCHAR(20) NOT NULL DEFAULT 'Media',
      gravidade VARCHAR(20) NOT NULL DEFAULT 'Moderada',
      estado VARCHAR(30) NOT NULL DEFAULT 'Aberta',
      resolucao TEXT,
      criado_em VARCHAR(10) NOT NULL,
      atualizado_em VARCHAR(10) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS ocorrencia_comentarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ocorrencia_id INT NOT NULL,
      comentario TEXT NOT NULL,
      tecnico_id INT,
      criado_em VARCHAR(19) NOT NULL,
      INDEX idx_occom_ocorrencia (ocorrencia_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    try {
      await db.execute(`INSERT INTO ocorrencia_comentarios (ocorrencia_id, comentario, tecnico_id, criado_em)
        SELECT id, comentario, comentario_tecnico_id, criado_em FROM ocorrencias
        WHERE comentario IS NOT NULL AND TRIM(comentario) != ''
          AND NOT EXISTS (SELECT 1 FROM ocorrencia_comentarios c WHERE c.ocorrencia_id = ocorrencias.id)`);
    } catch (_) {}
    try { await db.execute('ALTER TABLE ocorrencias DROP COLUMN comentario'); } catch (_) {}
    try { await db.execute('ALTER TABLE ocorrencias DROP COLUMN comentario_tecnico_id'); } catch (_) {}
    try { await db.execute('ALTER TABLE ocorrencias ADD COLUMN codigo VARCHAR(20) AFTER id'); } catch (_) {}
    try { await db.execute('ALTER TABLE ocorrencias ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT \'Erro\' AFTER titulo'); } catch (_) {}
    try { await db.execute('CREATE UNIQUE INDEX idx_ocor_codigo ON ocorrencias(codigo)'); } catch (_) {}
    try { await db.execute('ALTER TABLE ocorrencias ADD COLUMN alertado_em VARCHAR(10) NULL AFTER atualizado_em'); } catch (_) {}
    try {
      const [rows] = await db.execute('SELECT id FROM ocorrencias WHERE codigo IS NULL OR codigo = \'\' ORDER BY id ASC');
      for (const row of rows) {
        const padded = String(row.id).padStart(4, '0');
        await db.execute('UPDATE ocorrencias SET codigo=? WHERE id=?', ['OCR-' + padded, row.id]);
      }
    } catch (_) {}

    await db.execute(`CREATE TABLE IF NOT EXISTS ocorrencia_fotos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ocorrencia_id INT,
      dados LONGTEXT NOT NULL,
      INDEX idx_of_ocorrencia (ocorrencia_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS ocorrencia_videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ocorrencia_id INT,
      dados LONGTEXT NOT NULL,
      INDEX idx_ov_ocorrencia (ocorrencia_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS gastos_logistica (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tecnico_id INT,
      escola_id INT,
      tipo VARCHAR(50) NOT NULL DEFAULT 'Outros',
      valor DECIMAL(10,2) NOT NULL DEFAULT 0,
      data VARCHAR(10) NOT NULL,
      observacoes TEXT,
      criado_em VARCHAR(10) NOT NULL,
      categoria VARCHAR(20) NOT NULL DEFAULT 'tecnicos',
      INDEX idx_gl_tecnico (tecnico_id),
      INDEX idx_gl_escola (escola_id),
      INDEX idx_gl_data (data),
      INDEX idx_gl_categoria (categoria)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS saldo_logistica (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tecnico_id INT DEFAULT NULL,
      valor DECIMAL(10,2) NOT NULL DEFAULT 0,
      descricao VARCHAR(255) NOT NULL DEFAULT '',
      data VARCHAR(10) NOT NULL,
      criado_em VARCHAR(10) NOT NULL,
      categoria VARCHAR(20) NOT NULL DEFAULT 'tecnicos',
      INDEX idx_sl_tecnico (tecnico_id),
      INDEX idx_sl_categoria (categoria)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    try { await db.execute('ALTER TABLE saldo_logistica MODIFY tecnico_id INT DEFAULT NULL'); } catch (_) {}
    try { await db.execute('ALTER TABLE saldo_logistica ADD COLUMN categoria VARCHAR(20) NOT NULL DEFAULT \'tecnicos\''); } catch (_) {}
    try { await db.execute('ALTER TABLE gastos_logistica ADD COLUMN categoria VARCHAR(20) NOT NULL DEFAULT \'tecnicos\''); } catch (_) {}

    await db.execute(`CREATE TABLE IF NOT EXISTS gastos_escolas (
      gasto_id INT NOT NULL,
      escola_id INT NOT NULL,
      PRIMARY KEY (gasto_id, escola_id),
      INDEX idx_ge_escola (escola_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    try { await db.execute('ALTER TABLE gastos_escolas ADD COLUMN escola_nome VARCHAR(255) DEFAULT NULL'); } catch (_) {}

    try {
      await db.execute(`
        INSERT IGNORE INTO gastos_escolas (gasto_id, escola_id)
        SELECT id, escola_id FROM gastos_logistica
        WHERE escola_id IS NOT NULL AND escola_id > 0
      `);
    } catch (_) {}

    await db.execute(`CREATE TABLE IF NOT EXISTS faturas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      escola_id INT NOT NULL,
      numero VARCHAR(50) NOT NULL,
      descricao TEXT,
      valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      data_emissao VARCHAR(10) NOT NULL,
      data_vencimento VARCHAR(10) NOT NULL DEFAULT '',
      estado VARCHAR(30) NOT NULL DEFAULT 'Pendente',
      observacoes TEXT,
      criado_em VARCHAR(10) NOT NULL,
      atualizado_em VARCHAR(10) NOT NULL,
      INDEX idx_fat_escola (escola_id),
      INDEX idx_fat_estado (estado),
      INDEX idx_fat_data (data_emissao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await db.execute(`CREATE TABLE IF NOT EXISTS pagamentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fatura_id INT,
      escola_id INT NOT NULL,
      valor DECIMAL(12,2) NOT NULL DEFAULT 0,
      data_pagamento VARCHAR(10) NOT NULL,
      forma_pagamento VARCHAR(30) NOT NULL DEFAULT 'Mensal',
      metodo_pagamento VARCHAR(50) NOT NULL DEFAULT 'Transferência',
      referencia VARCHAR(255) NOT NULL DEFAULT '',
      estado VARCHAR(30) NOT NULL DEFAULT 'Confirmado',
      observacoes TEXT,
      criado_em VARCHAR(10) NOT NULL,
      atualizado_em VARCHAR(10) NOT NULL,
      INDEX idx_pag_fatura (fatura_id),
      INDEX idx_pag_escola (escola_id),
      INDEX idx_pag_estado (estado),
      INDEX idx_pag_data (data_pagamento),
      INDEX idx_pag_forma (forma_pagamento)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    console.log('MySQL schema initialized successfully');
  } finally {
    db.release();
  }
}

module.exports = { getPool, getDb, query, queryOne, initSchema };
