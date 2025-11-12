// Queries completas para a clínica ETEMFL
// Organizadas por categoria: READ (SELECT), CREATE (INSERT), UPDATE, DELETE

export const queries = {
  // ==================== QUERIES READ (SELECT) ====================
  
  // 1. HISTÓRICO GERAL (Todos os registros)
  historicoGeralTodos: `
    SELECT 
        historico_auditoria.id, 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente, 
        historico_auditoria.paciente_id 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 2. HISTÓRICO GERAL (Filtrado por intervalo de datas)
  historicoGeralPorData: `
    SELECT 
        historico_auditoria.id, 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.ocorrido_em BETWEEN ? AND ?   
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 3. HISTÓRICO GERAL (Filtro por especialista)
  historicoEspecialista: `
    SELECT 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.acao LIKE '%especialista%' 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 4. HISTÓRICO GERAL (Filtro por paciente)
  historicoPaciente: `
    SELECT 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.acao LIKE '%paciente%' 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 5. HISTÓRICO GERAL (Filtro por agendamento)
  historicoAgendamento: `
    SELECT 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.acao LIKE '%agendamento%' 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 6. HISTÓRICO GERAL (Filtro Confirmação/Cancelamento)
  historicoConfirmacao: `
    SELECT 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.acao LIKE '%confirmar%' OR historico_auditoria.acao LIKE '%cancelar%' 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 7. HISTÓRICO GERAL (Filtro comunicado)
  historicoComunicado: `
    SELECT 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.acao LIKE '%comunicado%' 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 8. HISTÓRICO GERAL (Filtro configuração)
  historicoConfiguracao: `
    SELECT 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.acao LIKE '%configuração%' 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 9. HISTÓRICO GERAL (Botão Redefinir Sistema)
  historicoRedefinir: `
    SELECT 
        historico_auditoria.ocorrido_em, 
        historico_auditoria.acao, 
        clinica_gestor.nome_clinica AS usuario, 
        paciente.nome AS paciente 
    FROM historico_auditoria   
    JOIN clinica_gestor ON clinica_gestor.id = historico_auditoria.gestor_id   
    LEFT JOIN paciente ON paciente.id = historico_auditoria.paciente_id 
    WHERE historico_auditoria.acao LIKE '%redefinir%' 
    ORDER BY historico_auditoria.ocorrido_em DESC
  `,

  // 10. AGENDAMENTOS GERAL
  agendamentosGeral: `
    SELECT 
        agendamento.id, 
        paciente.nome AS paciente, 
        paciente.cpf, 
        paciente.cartao_sus, 
        medico.especialidade AS especialidade, 
        medico.nome AS especialista, 
        vaga.data AS data_consulta, 
        agendamento.criado_em, 
        agendamento.status 
    FROM agendamento 
    JOIN paciente ON paciente.id = agendamento.paciente_id 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    JOIN medico ON medico.id = vaga.medico_id 
    ORDER BY agendamento.criado_em DESC
  `,

  // 11. AGENDAMENTOS FILTRADO POR CPF
  agendamentosPorCpf: `
    SELECT  
        agendamento.id,  
        paciente.nome,  
        paciente.cpf,  
        paciente.cartao_sus,  
        medico.especialidade AS especialidade, 
        medico.nome AS especialista,  
        vaga.data AS data_consulta,  
        agendamento.status 
    FROM agendamento 
    JOIN paciente ON paciente.id = agendamento.paciente_id 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    JOIN medico ON medico.id = vaga.medico_id 
    WHERE paciente.cpf = ? 
    ORDER BY agendamento.criado_em DESC
  `,

  // 12. AGENDAMENTOS FILTRADO POR CARTÃO SUS
  agendamentosPorSus: `
    SELECT  
        agendamento.id,  
        paciente.nome,  
        paciente.cpf,  
        paciente.cartao_sus,  
        medico.especialidade AS especialidade, 
        medico.nome AS especialista,  
        vaga.data AS data_consulta,  
        agendamento.status 
    FROM agendamento 
    JOIN paciente ON paciente.id = agendamento.paciente_id 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    JOIN medico ON medico.id = vaga.medico_id 
    WHERE paciente.cartao_sus = ? 
    ORDER BY agendamento.criado_em DESC
  `,

  // 13. AGENDAMENTOS POR INTERVALO DE DATAS
  agendamentosPorData: `
    SELECT  
        agendamento.id,  
        paciente.nome AS paciente,  
        medico.especialidade AS especialidade, 
        medico.nome AS especialista,  
        vaga.data AS data_consulta,  
        agendamento.status 
    FROM agendamento 
    JOIN paciente ON paciente.id = agendamento.paciente_id 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    JOIN medico ON medico.id = vaga.medico_id 
    WHERE vaga.data BETWEEN ? AND ? 
    ORDER BY vaga.data ASC
  `,

  // 14. AGENDAMENTOS CANCELADOS
  agendamentosCancelados: `
    SELECT  
        agendamento.id,  
        paciente.nome AS paciente,  
        vaga.data,  
        agendamento.status,  
        agendamento.motivo_cancelamento 
    FROM agendamento 
    JOIN paciente ON paciente.id = agendamento.paciente_id 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    WHERE agendamento.status = 'cancelado' 
    ORDER BY agendamento.criado_em DESC
  `,

  // 15. AGENDAMENTOS PARA CONFIRMAÇÃO EM MASSA
  agendamentosPendentes: `
    SELECT  
        agendamento.id,  
        paciente.nome AS paciente,  
        vaga.data,  
        agendamento.status 
    FROM agendamento 
    JOIN paciente ON paciente.id = agendamento.paciente_id 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    WHERE agendamento.status = 'pendente' 
    ORDER BY vaga.data
  `,

  // 16. AGENDAMENTOS PARA CANCELAMENTO EM MASSA
  agendamentosAtivos: `
    SELECT  
        agendamento.id,  
        paciente.nome AS paciente,  
        vaga.data,  
        agendamento.status 
    FROM agendamento 
    JOIN paciente ON paciente.id = agendamento.paciente_id 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    WHERE agendamento.status IN ('confirmado', 'pendente') 
    ORDER BY vaga.data
  `,

  // 17. MÉDICOS COM CONSULTAS NO PERÍODO
  medicosConsultasPeriodo: `
    SELECT  
        medico.nome AS especialista,  
        COUNT(*) AS total 
    FROM agendamento 
    JOIN vaga ON vaga.id = agendamento.vaga_id 
    JOIN medico ON medico.id = vaga.medico_id 
    WHERE vaga.data BETWEEN ? AND ? 
    GROUP BY medico.nome 
    ORDER BY total DESC
  `,

  // ==================== QUERIES CREATE (INSERT) ====================

  // 18. CADASTRAR NOVO USUÁRIO GESTOR
  inserirGestor: `
    INSERT INTO clinica_gestor (nome_clinica, endereco, telefone, senha_mestre, setor_id) 
    VALUES (?, ?, ?, ?, ?)
  `,

  // 19. CADASTRAR NOVA ESPECIALIDADE
  inserirEspecialidade: `
    INSERT INTO especialidade (nome, descricao, ativo) 
    VALUES (?, ?, 1)
  `,

  // 20. CADASTRAR NOVO MÉDICO
  inserirMedico: `
    INSERT INTO medico (nome, especialidade, registro_profissional) 
    VALUES (?, ?, ?)
  `,

  // 21. CADASTRAR NOVA VAGA
  inserirVaga: `
    INSERT INTO vaga (medico_id, data, hora_inicio, duracao_min, status, criado_por) 
    VALUES (?, ?, ?, ?, 'pendente', ?)
  `,

  // 22. CADASTRAR DIAS PARA VAGA
  inserirDiaVaga: `
    INSERT INTO dias_vaga (vaga_id, dia_id) 
    VALUES (?, ?)
  `,

  // 23. CADASTRAR NOVO SETOR
  inserirSetor: `
    INSERT INTO setor (nome, codigo) 
    VALUES (?, ?)
  `,

  // 24. CADASTRAR NOVO BAIRRO
  inserirBairro: `
    INSERT INTO bairro (nome, setor_id) 
    VALUES (?, ?)
  `,

  // 25. CADASTRAR COMUNICADO
  inserirComunicado: `
    INSERT INTO comunicado (titulo, corpo, criado_por, visibilidade) 
    VALUES (?, ?, ?, ?)
  `,

  // ==================== QUERIES UPDATE ====================

  // 26. CONFIRMAR AGENDAMENTO
  confirmarAgendamento: `
    UPDATE agendamento  
    SET status = 'confirmado', checkin_em = NOW() 
    WHERE id = ?
  `,

  // 27. CANCELAR AGENDAMENTO (gestor)
  cancelarAgendamento: `
    UPDATE agendamento  
    SET status = 'cancelado', motivo_cancelamento = ? 
    WHERE id = ?
  `,

  // 28. REALIZAR CHECKIN
  realizarCheckin: `
    UPDATE agendamento  
    SET checkin_em = NOW()  
    WHERE id = ?
  `,

  // 29. ATUALIZAR STATUS DA VAGA
  atualizarVagaStatus: `
    UPDATE vaga  
    SET status = ?  
    WHERE id = ?
  `,

  // 30. ATUALIZAR DADOS DO MÉDICO
  atualizarMedico: `
    UPDATE medico  
    SET nome = ?, especialidade = ?, registro_profissional = ?  
    WHERE id = ?
  `,

  // 31. ATUALIZAR ESPECIALIDADE
  atualizarEspecialidade: `
    UPDATE especialidade  
    SET nome = ?, descricao = ?, ativo = ?  
    WHERE id = ?
  `,

  // ==================== QUERIES DELETE ====================

  // 32. REMOVER VAGA (se não tiver agendamentos)
  deletarVaga: `
    DELETE FROM vaga  
    WHERE id = ?  
    AND NOT EXISTS (SELECT 1 FROM agendamento WHERE vaga_id = ?)
  `,

  // 33. REMOVER MÉDICO (soft delete)
  desativarMedico: `
    UPDATE medico SET ativo = 0 WHERE id = ?
  `,

  // 34. REMOVER ESPECIALIDADE (soft delete)
  desativarEspecialidade: `
    UPDATE especialidade SET ativo = 0 WHERE id = ?
  `,

  // 35. REMOVER COMUNICADO
  deletarComunicado: `
    DELETE FROM comunicado WHERE id = ?
  `,

  // 36. REMOVER DIAS DA VAGA
  deletarDiaVaga: `
    DELETE FROM dias_vaga WHERE vaga_id = ? AND dia_id = ?
  `,

  // 37. REMOVER USUÁRIO GESTOR (soft delete)
  desativarGestor: `
    UPDATE clinica_gestor SET ativo = 0 WHERE id = ?
  `
};
