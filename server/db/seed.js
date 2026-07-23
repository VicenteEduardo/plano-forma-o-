const { getDb, initSchema, query } = require('./database');

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  const dbDrop = await getDb();
  try {
    const tables = ['ocorrencia_videos','ocorrencia_fotos','ocorrencias','notas','plano_linhas','planos_formacao','reuniao_historico','reunioes','ausencias','eventos','tecnicos','escolas'];
    for (const t of tables) await dbDrop.execute(`DROP TABLE IF EXISTS ${t}`);
  } finally {
    dbDrop.release();
  }

  await initSchema();
  const db = await getDb();

  try {
    const today = '2026-07-23';

    const escStmt = await db.prepare('INSERT INTO escolas (nome, codigo) VALUES (?, ?)');
    const escolas = [
      ['Escola Secundária de Lisboa', 'ESC-00125'],
      ['Colégio Nossa Senhora', 'ESC-00098'],
      ['Escola Internacional de Luanda', 'ESC-00142'],
      ['Instituto Politécnico Viana', 'ESC-00077'],
      ['Escola Primária Kilamba', 'ESC-00033'],
      ['Universidade Agostinho Neto', 'ESC-00201'],
      ['Escola Nova Vida', 'ESC-00056'],
      ['Escola Secundária Viana', 'ESC-00061'],
      ['Instituto Médio Politécnico Kilamba', 'ESC-00089'],
      ['Colégio São Francisco', 'ESC-00114'],
    ];
    for (const e of escolas) await escStmt.execute(e);

    const techStmt = await db.prepare('INSERT INTO tecnicos (id, nome, email, telefone, area, equipa, estado, hora_inicio, hora_fim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const tecnicos = [
      [1, 'Délcio Bernardo', 'delciomanuelbernardo@gmail.com', '930016359', 'Assistente Técnico', 'Suporte Luanda', 'Disponível', '08:00', '17:00'],
      [2, 'Pedro Manuel', 'pedromanuel@eduall.ao', '+244 922 799 582', 'Assistência Técnica', 'Suporte Luanda', 'Ocupado', '08:00', '17:00'],
      [3, 'Ana Silva', 'ana.silva@eduall.ao', '+244 933 214 778', 'Técnica de Formação', 'Formação', 'Disponível', '08:30', '17:30'],
      [4, 'João Costa', 'joao.costa@eduall.ao', '+244 912 456 001', 'Técnico de Instalação', 'Instalações Norte', 'Ocupado', '07:30', '16:30'],
      [5, 'Maria Fernandes', 'maria.fernandes@eduall.ao', '+244 927 883 220', 'Assistente Técnico', 'Suporte Benguela', 'Férias', '08:00', '17:00'],
      [6, 'Carlos Santos', 'carlos.santos@eduall.ao', '+244 944 100 552', 'Comercial Técnico', 'Comercial', 'Disponível', '08:00', '17:00'],
    ];
    for (const t of tecnicos) await techStmt.execute(t);

    const evtStmt = await db.prepare('INSERT INTO eventos (id, titulo, descricao, data, hora_inicio, hora_fim, tecnico_id, local, prioridade, estado, tipo, responsavel, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const eventos = [
      [1, 'Instalação de rede - Escola Primária Kilamba', 'Instalação completa de infraestrutura de rede.', today, '08:00', '11:00', 1, 'Kilamba, Luanda', 'Alta', 'Confirmado', 'Instalação', 'Técnico', 'Levar switch adicional.'],
      [2, 'Assistência técnica urgente - Cliente Eduall', 'Resolução de falha no servidor local.', today, '11:30', '13:00', 2, 'Talatona, Luanda', 'Alta', 'Em curso', 'Assistência técnica', 'Técnico', ''],
      [3, 'Reunião de planeamento semanal', 'Alinhamento das tarefas da semana.', today, '14:00', '15:00', 1, 'Escritório Central', 'Média', 'Agendado', 'Reunião', 'Ambos', ''],
      [4, 'Formação: Novo sistema de gestão escolar', 'Sessão de formação para equipa docente.', today, '09:00', '12:00', 3, 'Escola Secundária Viana', 'Média', 'Confirmado', 'Formação', 'Técnico', ''],
      [5, 'Manutenção preventiva - Laboratório Informática', 'Verificação de equipamentos.', today, '13:00', '17:00', 4, 'Instituto Politécnico Viana', 'Baixa', 'Agendado', 'Manutenção', 'Técnico', ''],
      [6, 'Apresentação de proposta comercial', 'Apresentação da plataforma a novo cliente.', today, '16:00', '17:00', 6, 'Sede Cliente - Maianga', 'Alta', 'Agendado', 'Apresentação', 'Comercial', ''],
      [7, 'Instalação de projetores', '', shiftDate(today,1), '08:00', '10:00', 4, 'Escola Cazenga', 'Média', 'Agendado', 'Instalação', 'Técnico', ''],
      [8, 'Assistência técnica - impressoras', '', shiftDate(today,1), '10:30', '12:00', 2, 'Cliente Rangel', 'Média', 'Confirmado', 'Assistência técnica', 'Técnico', ''],
      [9, 'Trabalho de campo - levantamento técnico', '', shiftDate(today,1), '13:00', '17:00', 1, 'Zona Industrial Viana', 'Baixa', 'Agendado', 'Trabalho', 'Técnico', ''],
      [10, 'Reunião com direção pedagógica', '', shiftDate(today,1), '09:00', '10:00', 3, 'Colégio Nossa Senhora', 'Média', 'Agendado', 'Reunião', 'Ambos', ''],
      [11, 'Formação de professores - módulo avançado', '', shiftDate(today,2), '08:00', '13:00', 3, 'Escola Internacional', 'Alta', 'Confirmado', 'Formação', 'Técnico', ''],
      [12, 'Manutenção de servidores', '', shiftDate(today,2), '08:00', '12:00', 1, 'Data Center Talatona', 'Alta', 'Agendado', 'Manutenção', 'Técnico', ''],
      [13, 'Trabalho de instalação de rede WiFi', '', shiftDate(today,2), '08:00', '16:00', 4, 'Universidade Agostinho Neto', 'Alta', 'Confirmado', 'Instalação', 'Técnico', 'Dia inteiro no local.'],
      [14, 'Assistência remota - suporte software', '', shiftDate(today,2), '14:00', '15:30', 2, 'Remoto', 'Baixa', 'Agendado', 'Assistência técnica', 'Técnico', ''],
      [15, 'Apresentação institucional', '', shiftDate(today,3), '10:00', '11:30', 6, 'Câmara Municipal', 'Média', 'Agendado', 'Apresentação', 'Comercial', ''],
      [16, 'Outros - deslocação e logística', '', shiftDate(today,3), '08:00', '09:00', 1, 'Trânsito', 'Baixa', 'Agendado', 'Outros', 'Técnico', ''],
      [17, 'Assistência técnica - rede local', '', shiftDate(today,3), '09:30', '12:30', 2, 'Escola Maianga', 'Alta', 'Confirmado', 'Assistência técnica', 'Técnico', ''],
      [18, 'Trabalho administrativo interno', '', shiftDate(today,3), '13:00', '17:00', 4, 'Escritório Central', 'Baixa', 'Agendado', 'Trabalho', 'Técnico', ''],
      [19, 'Reunião mensal de equipa', '', shiftDate(today,5), '09:00', '10:30', 1, 'Escritório Central', 'Média', 'Agendado', 'Reunião', 'Ambos', ''],
      [20, 'Instalação de equipamento audiovisual', '', shiftDate(today,5), '11:00', '14:00', 2, 'Auditório Municipal', 'Média', 'Agendado', 'Instalação', 'Técnico', ''],
      [21, 'Formação sobre segurança de dados', '', shiftDate(today,5), '14:30', '17:00', 3, 'Sede Eduall', 'Alta', 'Confirmado', 'Formação', 'Técnico', ''],
      [22, 'Manutenção geral de laboratórios', '', shiftDate(today,-2), '08:00', '12:00', 4, 'Escola Politécnica', 'Média', 'Concluído', 'Manutenção', 'Técnico', 'Concluído sem incidentes.'],
      [23, 'Assistência técnica - rede elétrica', '', shiftDate(today,-1), '09:00', '11:00', 2, 'Cliente Ingombota', 'Alta', 'Concluído', 'Assistência técnica', 'Técnico', ''],
      [24, 'Reunião cancelada - reagendar', '', shiftDate(today,-1), '15:00', '16:00', 6, 'Escritório Central', 'Baixa', 'Cancelado', 'Reunião', 'Comercial', 'Cliente remarcou.'],
      [25, 'Trabalho de campo - inventário técnico', '', shiftDate(today,8), '08:00', '12:00', 1, 'Armazém Central', 'Baixa', 'Agendado', 'Trabalho', 'Técnico', ''],
      [26, 'Instalação escolar completa', '', shiftDate(today,10), '08:00', '17:00', 4, 'Escola Nova Vida', 'Alta', 'Agendado', 'Instalação', 'Técnico', 'Evento de dia inteiro.'],
      [27, 'Apresentação de resultados trimestrais', '', shiftDate(today,12), '10:00', '11:00', 6, 'Sede Eduall', 'Média', 'Agendado', 'Apresentação', 'Ambos', ''],
    ];
    for (const e of eventos) await evtStmt.execute(e);

    const ausStmt = await db.prepare('INSERT INTO ausencias (id, tecnico_id, tipo, inicio, fim, meio_dia, motivo, observacoes, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const ausencias = [
      [1, 5, 'Férias', shiftDate(today,-2), shiftDate(today,5), 0, 'Férias anuais', '', 'Aprovado'],
      [2, 2, 'Day Off', today, today, 1, 'Assunto pessoal', '', 'Aprovado'],
      [3, 6, 'Baixa Médica', shiftDate(today,-1), shiftDate(today,2), 0, 'Recuperação médica', 'Atestado entregue ao RH', 'Aprovado'],
      [4, 4, 'Day Off', shiftDate(today,3), shiftDate(today,3), 0, '', '', 'Pendente'],
      [5, 3, 'Formação', shiftDate(today,6), shiftDate(today,7), 0, 'Certificação externa', '', 'Aprovado'],
    ];
    for (const a of ausencias) await ausStmt.execute(a);

    const reuStmt = await db.prepare('INSERT INTO reunioes (id, escola_id, data, hora_inicio, hora_fim, estado, direcao_escola, direcao_eduall, administracao_eduall, tecnico_id, outros_participantes, objetivos, assuntos, descricao, decisoes, notas, proximos_passos, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    await reuStmt.execute([1, 1, shiftDate(today,4), '10:00', '11:00', 'Agendada', 'Diretor Pedagógico — Sr. Fonseca', 'Ana Diretora', '', 1, '', 'Alinhar plano de formação do próximo trimestre.', 'Formações, equipamentos, calendário', '', '', '', 'Enviar proposta de calendário até sexta-feira.', today, today]);
    await reuStmt.execute([2, 4, shiftDate(today,-3), '14:00', '15:00', 'Concluída', 'Diretora Geral — Dra. Marta', 'Carlos Administração', 'Sofia Finanças', 4, '', 'Revisão do contrato de manutenção anual.', '', '', 'Renovação aprovada por mais 12 meses.', '', 'Emitir novo contrato.', shiftDate(today,-10), shiftDate(today,-3)]);

    const rhStmt = await db.prepare('INSERT INTO reuniao_historico (reuniao_id, data, acao) VALUES (?, ?, ?)');
    await rhStmt.execute([1, today, 'Reunião criada']);
    await rhStmt.execute([2, shiftDate(today,-10), 'Reunião criada']);
    await rhStmt.execute([2, shiftDate(today,-3), 'Estado alterado para Concluída']);

    const planoStmt = await db.prepare('INSERT INTO planos_formacao (id, escola_id, titulo, responsavel_id, versao, estado, observacoes, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    await planoStmt.execute([1, 8, 'Plano de Formação — Julho 2026', 3, 'v1.2', 'Aprovado', 'Formação de professores em novo sistema de gestão escolar.', shiftDate(today,-20), shiftDate(today,-3)]);
    await planoStmt.execute([2, 4, 'Plano de Formação — Segurança de Dados', 1, 'v1.0', 'Em execução', '', shiftDate(today,-5), shiftDate(today,-1)]);
    await planoStmt.execute([3, 5, 'Plano de Formação — Onboarding Kilamba', 3, 'v0.1', 'Rascunho', 'Aguarda validação da direção pedagógica.', shiftDate(today,-1), shiftDate(today,-1)]);

    const linhaStmt = await db.prepare('INSERT INTO plano_linhas (id, plano_id, dia, data, hora, duracao, objetivo, tecnico_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    await linhaStmt.execute([1, 1, 'Dia 1', shiftDate(today,-15), '08:00', '3h', 'Introdução ao sistema', 3]);
    await linhaStmt.execute([2, 2, 'Dia 1', shiftDate(today,5), '14:00', '2h30', 'Boas práticas de segurança', 1]);

    const notaStmt = await db.prepare('INSERT INTO notas (id, titulo, descricao, imagem, criado_em) VALUES (?, ?, ?, ?, ?)');
    await notaStmt.execute([1, 'Falta de material em Benguela', 'A equipa de suporte de Benguela reportou falta de cabos de rede para as próximas instalações.', null, shiftDate(today,-3)]);
    await notaStmt.execute([2, 'Cliente satisfeito - Escola Viana', 'Feedback muito positivo após a formação de professores realizada esta semana.', null, shiftDate(today,-1)]);

    const ocorStmt = await db.prepare('INSERT INTO ocorrencias (id, titulo, escola_id, descricao, tecnico_id, evento_id, prioridade, gravidade, estado, resolucao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    await ocorStmt.execute([1, 'Impressora não liga', 8, 'Cliente reporta que a impressora da secretaria deixou de ligar depois de uma queda de energia.', 2, 8, 'Alta', 'Grave', 'Em análise', '', shiftDate(today,-1), shiftDate(today,-1)]);
    await ocorStmt.execute([2, 'Rede WiFi instável no laboratório', 4, 'Professores relatam quedas frequentes de ligação durante as aulas práticas.', 4, 5, 'Média', 'Moderada', 'Aberta', '', today, today]);
    await ocorStmt.execute([3, 'Servidor local encravado', 4, 'Servidor deixou de responder e sistema de gestão escolar ficou indisponível para toda a escola.', 2, 2, 'Urgente', 'Crítica', 'Resolvida', 'Substituída a fonte de alimentação do servidor e reiniciado o serviço; sistema validado com o cliente.', shiftDate(today,-2), shiftDate(today,-1)]);

    console.log('MySQL seed completed successfully!');
  } finally {
    await db.release();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
