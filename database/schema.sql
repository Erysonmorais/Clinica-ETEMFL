CREATE TABLE IF NOT EXISTS clinica_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome_clinica TEXT NOT NULL DEFAULT 'Clínica ETEMFL',
  endereco TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  senha_mestre_hash CHAR(64),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  tipo_conselho TEXT NOT NULL DEFAULT '',
  registro_profissional TEXT NOT NULL DEFAULT '',
  turnos TEXT[] NOT NULL DEFAULT ARRAY['manhã']::TEXT[],
  vagas_manha SMALLINT NOT NULL DEFAULT 0 CHECK (vagas_manha >= 0),
  vagas_tarde SMALLINT NOT NULL DEFAULT 0 CHECK (vagas_tarde >= 0),
  dias_atendimento SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::SMALLINT[],
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pacientes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  data_nascimento DATE,
  cpf CHAR(11) NOT NULL UNIQUE,
  cartao_sus CHAR(15) NOT NULL UNIQUE,
  bairro TEXT NOT NULL DEFAULT '',
  setor TEXT CHECK (setor IS NULL OR setor ~ '^[A-E][1-5]$'),
  senha_hash TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gestores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('paciente', 'gestor')),
  paciente_id BIGINT REFERENCES pacientes(id) ON DELETE CASCADE,
  gestor_id BIGINT REFERENCES gestores(id) ON DELETE CASCADE,
  expira_em TIMESTAMPTZ NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (tipo = 'paciente' AND paciente_id IS NOT NULL AND gestor_id IS NULL) OR
    (tipo = 'gestor' AND gestor_id IS NOT NULL AND paciente_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS sessoes_expira_idx ON sessoes (expira_em);

CREATE TABLE IF NOT EXISTS agendamentos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id BIGINT NOT NULL REFERENCES medicos(id) ON DELETE RESTRICT,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado')),
  motivo_cancelamento TEXT,
  cliente_request_id TEXT UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_medico_id_data_hora_key;
CREATE UNIQUE INDEX IF NOT EXISTS agendamentos_medico_horario_ativo_idx
  ON agendamentos (medico_id, data, hora) WHERE status <> 'Cancelado';

CREATE INDEX IF NOT EXISTS agendamentos_paciente_data_idx
  ON agendamentos (paciente_id, data DESC);
CREATE INDEX IF NOT EXISTS agendamentos_status_data_idx
  ON agendamentos (status, data);

CREATE TABLE IF NOT EXISTS comunicados (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  setor TEXT CHECK (setor IS NULL OR setor ~ '^[A-E][1-5]$'),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  acao TEXT NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}'::JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notificacoes_paciente_idx
  ON notificacoes (paciente_id, criado_em DESC);

INSERT INTO clinica_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
