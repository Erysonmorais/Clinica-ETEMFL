INSERT INTO clinica_config (id, nome_clinica, endereco, telefone)
VALUES (1, 'Clínica ETEMFL', 'Endereço de demonstração - atualizar antes de usar', '(00) 00000-0000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medicos
  (nome, especialidade, tipo_conselho, registro_profissional, turnos, vagas_manha, vagas_tarde, dias_atendimento)
SELECT 'Dra. Ana Exemplo', 'Clínico Geral', 'CRM', 'CRM-DEMO-001',
       ARRAY['manhã','tarde'], 8, 6, ARRAY[1,2,3,4,5]::SMALLINT[]
WHERE NOT EXISTS (SELECT 1 FROM medicos WHERE registro_profissional = 'CRM-DEMO-001');

INSERT INTO medicos
  (nome, especialidade, tipo_conselho, registro_profissional, turnos, vagas_manha, vagas_tarde, dias_atendimento)
SELECT 'Dr. Bruno Exemplo', 'Dentista', 'CRO', 'CRO-DEMO-001',
       ARRAY['manhã'], 5, 0, ARRAY[1,3,5]::SMALLINT[]
WHERE NOT EXISTS (SELECT 1 FROM medicos WHERE registro_profissional = 'CRO-DEMO-001');
