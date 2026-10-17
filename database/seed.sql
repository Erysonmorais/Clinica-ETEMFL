INSERT INTO clinica_config (id, nome_clinica, endereco, telefone)
VALUES (1, 'Clínica ETEMFL', 'Endereço de demonstração - atualizar antes de usar', '(00) 00000-0000')
ON CONFLICT (id) DO NOTHING;

-- Seed sem especialistas de exemplo nem dados de pacientes.
-- O cadastro de profissionais e pacientes deverá ser realizado pela gestão do sistema.
