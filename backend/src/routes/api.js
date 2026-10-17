const express = require('express');
const { createHash, timingSafeEqual, scrypt, randomBytes } = require('node:crypto');
const { promisify } = require('node:util');
const { pool } = require('../db');
const {
  SESSION_COOKIES,
  authenticateToken,
  clearSessionCookie,
  createSession,
  getCookie,
  hashPassword,
  requireAuth,
  verifyPassword
} = require('../auth');

const router = express.Router();
const scryptAsync = promisify(scrypt);
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const digits = value => String(value || '').replace(/\D/g, '');
const asNullable = value => value === '' || value === undefined ? null : value;

function isValidCpf(value) {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = length => {
    let sum = 0;
    for (let index = 0; index < length; index++) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function required(value, label) {
  if (value === undefined || value === null || value === '') fail(400, `${label} é obrigatório.`);
}

function audit(client, entity, id, action, data = {}) {
  return client.query(
    'INSERT INTO auditoria (entidade, entidade_id, acao, dados) VALUES ($1, $2, $3, $4)',
    [entity, id == null ? null : String(id), action, JSON.stringify(data)]
  );
}

function emit(req, type, payload, audience) {
  req.app.locals.broadcast({ type, payload, audience });
}

function patientPassword(value) {
  if (!value) return null;
  const salt = randomBytes(16).toString('hex');
  return scryptAsync(String(value), salt, 64).then(key => `scrypt:${salt}:${key.toString('hex')}`);
}

function mapConfig(row) {
  return {
    id: row.id,
    nome_clinica: row.nome_clinica,
    endereco: row.endereco,
    telefone: row.telefone,
    senha_mestre_configurada: Boolean(row.senha_mestre_hash),
    atualizado_em: row.atualizado_em
  };
}

router.get('/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

router.get('/gestores', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id,nome_clinica,endereco,telefone,senha_mestre_hash,atualizado_em FROM clinica_config WHERE id = 1'
  );
  res.json(rows.map(mapConfig));
}));

const loginAttempts = new Map();

function checkLoginLimit(req) {
  const key = req.ip;
  const state = loginAttempts.get(key);
  if (state && state.resetAt > Date.now() && state.count >= 10) {
    fail(429, 'Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.');
  }
  if (!state || state.resetAt <= Date.now()) loginAttempts.set(key, { count: 1, resetAt: Date.now() + 15 * 60_000 });
  else state.count++;
}

router.post('/auth/paciente/cadastro', asyncRoute(async (req, res) => {
  const body = req.body;
  checkLoginLimit(req);
  required(body.nome, 'Nome');
  required(body.data_nascimento, 'Data de nascimento');
  required(body.senha, 'Senha');
  if (String(body.senha).length < 8) fail(400, 'A senha deve ter pelo menos 8 caracteres.');
  const cpf = digits(body.cpf);
  const sus = digits(body.cartao_sus || body.sus);
  if (!isValidCpf(cpf)) fail(400, 'CPF inválido.');
  if (sus.length !== 15) fail(400, 'Cartão SUS deve conter 15 dígitos.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query(
      `INSERT INTO pacientes
         (nome,data_nascimento,cpf,cartao_sus,bairro,setor,senha_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,nome,data_nascimento,cpf,cartao_sus,bairro,setor`,
      [
        body.nome.trim(), body.data_nascimento, cpf, sus, body.bairro || '',
        body.setor || null, await hashPassword(String(body.senha))
      ]
    );
    const patient = created.rows[0];
    await audit(client, 'paciente', patient.id, 'cadastro', { nome: patient.nome });
    const token = randomBytes(32).toString('base64url');
    await client.query(
      `INSERT INTO sessoes (token_hash,tipo,paciente_id,expira_em)
       VALUES ($1,'paciente',$2,NOW() + INTERVAL '7 days')`,
      [createHash('sha256').update(token).digest('hex'), patient.id]
    );
    await client.query('COMMIT');
    const secure = req.secure || req.get('x-forwarded-proto') === 'https';
    const maxAge = 7 * 24 * 60 * 60;
    res.append('Set-Cookie', [
      `${SESSION_COOKIES.paciente}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict',
      `Max-Age=${maxAge}`, ...(secure ? ['Secure'] : [])
    ].join('; '));
    loginAttempts.delete(req.ip);
    emit(req, 'paciente_update', { id: patient.id }, { type: 'gestor' });
    res.status(201).json({ type: 'paciente', ...patient });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.post('/auth/paciente/login', asyncRoute(async (req, res) => {
  checkLoginLimit(req);
  const cpf = digits(req.body.cpf);
  const sus = digits(req.body.cartao_sus || req.body.sus);
  const { rows } = await pool.query(
    `SELECT id,nome,data_nascimento,cpf,cartao_sus,bairro,setor,senha_hash
     FROM pacientes WHERE cpf=$1 AND cartao_sus=$2`,
    [cpf, sus]
  );
  if (!rows[0] || !await verifyPassword(String(req.body.senha || ''), rows[0].senha_hash)) {
    fail(401, 'CPF, Cartão SUS ou senha incorretos.');
  }
  const patient = rows[0];
  delete patient.senha_hash;
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  await createSession('paciente', patient.id, res, secure);
  loginAttempts.delete(req.ip);
  res.json({ type: 'paciente', ...patient });
}));

router.post('/auth/gestor/login', asyncRoute(async (req, res) => {
  checkLoginLimit(req);
  const email = String(req.body.email || '').trim().toLowerCase();
  const { rows } = await pool.query(
    'SELECT id,email,senha_hash FROM gestores WHERE email=$1 AND ativo=TRUE',
    [email]
  );
  if (!rows[0] || !await verifyPassword(String(req.body.senha || ''), rows[0].senha_hash)) {
    fail(401, 'E-mail ou senha incorretos.');
  }
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  await createSession('gestor', rows[0].id, res, secure);
  loginAttempts.delete(req.ip);
  res.json({ type: 'gestor', id: rows[0].id, email: rows[0].email });
}));

router.get('/auth/me', asyncRoute(async (req, res) => {
  const portal = req.get('x-etemfl-portal');
  const type = ['paciente', 'gestor'].includes(portal)
    ? portal
    : getCookie(req, SESSION_COOKIES.gestor) ? 'gestor' : 'paciente';
  const identity = await authenticateToken(getCookie(req, SESSION_COOKIES[type]));
  if (!identity) return res.status(401).json({ error: 'Sessão não encontrada ou expirada.' });
  res.json(identity);
}));

router.post('/auth/logout', asyncRoute(async (req, res) => {
  const requestedPortal = req.get('x-etemfl-portal');
  const type = ['paciente', 'gestor'].includes(requestedPortal)
    ? requestedPortal
    : getCookie(req, SESSION_COOKIES.gestor) ? 'gestor' : 'paciente';
  const token = getCookie(req, SESSION_COOKIES[type]);
  if (token) {
    await pool.query('DELETE FROM sessoes WHERE token_hash=$1', [
      createHash('sha256').update(token).digest('hex')
    ]);
  }
  clearSessionCookie(res, req.secure || req.get('x-forwarded-proto') === 'https', type);
  res.json({ success: true });
}));

router.post('/gestores', requireAuth, asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const { nome_clinica, endereco, telefone, senha_mestre } = req.body;
  if (senha_mestre != null && !/^[a-f0-9]{64}$/i.test(senha_mestre)) {
    fail(400, 'A senha mestre deve ser enviada como hash SHA-256 hexadecimal.');
  }
  const { rows } = await pool.query(
    `UPDATE clinica_config SET
       nome_clinica = COALESCE($1, nome_clinica),
       endereco = COALESCE($2, endereco),
       telefone = COALESCE($3, telefone),
       senha_mestre_hash = COALESCE($4, senha_mestre_hash),
       atualizado_em = NOW()
     WHERE id = 1 RETURNING *`,
    [asNullable(nome_clinica), asNullable(endereco), asNullable(telefone), senha_mestre || null]
  );
  const config = mapConfig(rows[0]);
  await pool.query(
    "INSERT INTO auditoria (entidade, acao, dados) VALUES ('clinica_config', 'atualizar', $1)",
    [JSON.stringify(config)]
  );
  emit(req, 'gestor_update', config);
  res.json(config);
}));

router.get('/medicos', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM medicos WHERE ativo=TRUE ORDER BY especialidade, nome');
  res.json(rows);
}));

router.use(requireAuth);

router.post('/medicos', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const body = req.body;
  required(body.nome, 'Nome');
  required(body.especialidade, 'Especialidade');
  const { rows } = await pool.query(
    `INSERT INTO medicos
      (nome, especialidade, tipo_conselho, registro_profissional, turnos, vagas_manha, vagas_tarde, dias_atendimento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      body.nome.trim(), body.especialidade.trim(), body.tipo_conselho || '',
      body.registro_profissional || body.crm || '',
      Array.isArray(body.turnos) ? body.turnos : body.turno ? [body.turno] : ['manhã'],
      Number(body.vagas_manha ?? body.vagasManha ?? 0),
      Number(body.vagas_tarde ?? body.vagasTarde ?? 0),
      Array.isArray(body.dias_atendimento ?? body.dias) ? (body.dias_atendimento ?? body.dias) : [1,2,3,4,5]
    ]
  );
  await audit(pool, 'medico', rows[0].id, 'criar', rows[0]);
  emit(req, 'medico_update', rows[0]);
  res.status(201).json(rows[0]);
}));

router.put('/medicos/:id', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const body = req.body;
  const { rows } = await pool.query(
    `UPDATE medicos SET
      nome=COALESCE($2,nome), especialidade=COALESCE($3,especialidade),
      tipo_conselho=COALESCE($4,tipo_conselho),
      registro_profissional=COALESCE($5,registro_profissional),
      turnos=COALESCE($6,turnos), vagas_manha=COALESCE($7,vagas_manha),
      vagas_tarde=COALESCE($8,vagas_tarde), dias_atendimento=COALESCE($9,dias_atendimento),
      ativo=COALESCE($10,ativo)
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, asNullable(body.nome), asNullable(body.especialidade), asNullable(body.tipo_conselho),
      asNullable(body.registro_profissional || body.crm),
      body.turnos ? body.turnos : body.turno ? [body.turno] : null,
      body.vagas_manha ?? body.vagasManha ?? null, body.vagas_tarde ?? body.vagasTarde ?? null,
      body.dias_atendimento ?? body.dias ?? null, body.ativo ?? null
    ]
  );
  if (!rows[0]) fail(404, 'Especialista não encontrado.');
  await audit(pool, 'medico', rows[0].id, 'atualizar', body);
  emit(req, 'medico_update', rows[0]);
  res.json(rows[0]);
}));

router.delete('/medicos/:id', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const result = await pool.query('UPDATE medicos SET ativo=FALSE WHERE id=$1', [req.params.id]);
  if (!result.rowCount) fail(404, 'Especialista não encontrado.');
  await pool.query(
    "INSERT INTO auditoria (entidade, entidade_id, acao) VALUES ('medico', $1, 'excluir')",
    [req.params.id]
  );
  emit(req, 'medico_delete', { id: req.params.id });
  res.json({ success: true });
}));

router.get('/pacientes', asyncRoute(async (req, res) => {
  const filters = [];
  const values = [];
  if (req.query.cpf) {
    values.push(digits(req.query.cpf));
    filters.push(`cpf=$${values.length}`);
  }
  if (req.query.cartao_sus) {
    values.push(digits(req.query.cartao_sus));
    filters.push(`cartao_sus=$${values.length}`);
  }
  if (req.auth.type === 'paciente') {
    values.push(req.auth.id);
    filters.push(`pacientes.id=$${values.length}`);
  }
  const result = await pool.query(
    `SELECT id,nome,data_nascimento,cpf,cartao_sus,bairro,setor,criado_em FROM pacientes
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY nome`,
    values
  );
  res.json(result.rows);
}));

router.post('/pacientes', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const body = req.body;
  required(body.nome, 'Nome');
  const cpf = digits(body.cpf);
  if (!isValidCpf(cpf)) fail(400, 'CPF inválido.');
  const sus = digits(body.cartao_sus || body.sus);
  if (sus.length !== 15) fail(400, 'Cartão SUS deve conter 15 dígitos.');
  const password = body.senha_cadastro || body.senha;
  if (!password || String(password).length < 8) fail(400, 'Informe uma senha inicial com pelo menos 8 caracteres.');
  const pwd = await patientPassword(password);
  const obs = typeof body.observacoes === 'string' ? (() => {
    try { return JSON.parse(body.observacoes); } catch { return {}; }
  })() : {};
  const { rows } = await pool.query(
    `INSERT INTO pacientes (nome,data_nascimento,cpf,cartao_sus,bairro,setor,senha_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id,nome,data_nascimento,cpf,cartao_sus,bairro,setor,criado_em`,
    [
      body.nome.trim(), asNullable(body.data_nascimento), cpf, sus,
      body.bairro || obs.bairro || '', body.setor || obs.setor || null, pwd
    ]
  );
  await audit(pool, 'paciente', rows[0].id, 'criar', { nome: rows[0].nome });
  emit(req, 'paciente_update', { id: rows[0].id }, { type: 'gestor' });
  res.status(201).json(rows[0]);
}));

router.put('/pacientes/:id', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const body = req.body;
  const cpf = body.cpf === undefined ? null : digits(body.cpf);
  if (cpf !== null && !isValidCpf(cpf)) fail(400, 'CPF inválido.');
  const sus = body.cartao_sus === undefined ? null : digits(body.cartao_sus);
  if (sus !== null && sus.length !== 15) fail(400, 'Cartão SUS deve conter 15 dígitos.');
  const obs = typeof body.observacoes === 'string' ? (() => {
    try { return JSON.parse(body.observacoes); } catch { return {}; }
  })() : {};
  const { rows } = await pool.query(
    `UPDATE pacientes SET nome=COALESCE($2,nome), data_nascimento=COALESCE($3,data_nascimento),
       cpf=COALESCE($4,cpf), cartao_sus=COALESCE($5,cartao_sus),
       bairro=COALESCE($6,bairro), setor=COALESCE($7,setor)
     WHERE id=$1
     RETURNING id,nome,data_nascimento,cpf,cartao_sus,bairro,setor,criado_em`,
    [
      req.params.id, asNullable(body.nome), asNullable(body.data_nascimento), cpf,
      sus, body.bairro ?? obs.bairro ?? null, body.setor ?? obs.setor ?? null
    ]
  );
  if (!rows[0]) fail(404, 'Paciente não encontrado.');
  await audit(pool, 'paciente', rows[0].id, 'atualizar', { nome: rows[0].nome });
  emit(req, 'paciente_update', { id: rows[0].id });
  res.json(rows[0]);
}));

router.delete('/pacientes/:id', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const result = await pool.query('DELETE FROM pacientes WHERE id=$1', [req.params.id]);
  if (!result.rowCount) fail(404, 'Paciente não encontrado.');
  await pool.query(
    "INSERT INTO auditoria (entidade, entidade_id, acao) VALUES ('paciente', $1, 'excluir')",
    [req.params.id]
  );
  emit(req, 'paciente_delete', { id: req.params.id }, { type: 'gestor' });
  res.json({ success: true });
}));

router.get('/agendamentos', asyncRoute(async (req, res) => {
  const values = [];
  const where = [];
  for (const [key, expression] of [
    ['cpf', 'p.cpf=$VALUE'], ['cartao_sus', 'p.cartao_sus=$VALUE'],
    ['data_de', 'a.data >= $VALUE'], ['data_ate', 'a.data <= $VALUE'],
    ['status', 'a.status=$VALUE']
  ]) {
    if (req.query[key]) {
      const val = key === 'cpf' || key === 'cartao_sus' ? digits(req.query[key]) : req.query[key];
      values.push(val);
      where.push(expression.replace('$VALUE', `$${values.length}`));
    }
  }
  if (req.auth.type === 'paciente') {
    values.push(req.auth.id);
    where.push(`a.paciente_id=$${values.length}`);
  }
  const { rows } = await pool.query(
    `SELECT a.*, p.nome AS paciente_nome, p.cpf AS paciente_cpf, p.cartao_sus AS paciente_sus,
            m.nome AS medico_nome, m.especialidade
     FROM agendamentos a JOIN pacientes p ON p.id=a.paciente_id
     JOIN medicos m ON m.id=a.medico_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY a.data DESC, a.hora DESC`,
    values
  );
  res.json(rows);
}));

router.post('/agendamentos/full', asyncRoute(async (req, res) => {
  const { paciente = {}, vaga = {} } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let patientId = req.auth.type === 'paciente' ? req.auth.id : paciente.id;
    if (req.auth.type === 'gestor' && !patientId) {
      const cpf = digits(paciente.cpf);
      if (cpf.length !== 11) fail(400, 'CPF do paciente inválido.');
      const created = await client.query(
        'SELECT id FROM pacientes WHERE cpf=$1',
        [cpf]
      );
      if (!created.rows[0]) fail(404, 'Cadastre o paciente antes de agendar.');
      patientId = created.rows[0].id;
    }
    if (req.auth.type === 'paciente' && paciente.id && Number(paciente.id) !== Number(patientId)) {
      fail(403, 'Não é permitido agendar para outro paciente.');
    }
    const doctorId = vaga.medico_db_id || vaga.medico_id;
    required(doctorId, 'Especialista');
    required(vaga.data, 'Data');
    required(vaga.hora_inicio || vaga.hora, 'Horário');
    const lock = await client.query(
      'SELECT dias_atendimento,turnos,vagas_manha,vagas_tarde FROM medicos WHERE id=$1 AND ativo=TRUE FOR UPDATE',
      [doctorId]
    );
    if (!lock.rows[0]) fail(404, 'Especialista não encontrado ou inativo.');
    const doctor = lock.rows[0];
    const appointmentDate = new Date(`${vaga.data}T00:00:00Z`);
    if (Number.isNaN(appointmentDate.getTime()) || appointmentDate <= new Date(new Date().toISOString().slice(0, 10))) {
      fail(400, 'A data do agendamento deve ser futura e válida.');
    }
    const weekDay = appointmentDate.getUTCDay();
    if (!doctor.dias_atendimento.includes(weekDay)) fail(409, 'Especialista não atende nesse dia.');
    const time = String(vaga.hora_inicio || vaga.hora);
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)/.exec(time);
    if (!timeMatch) fail(400, 'Horário inválido.');
    const minutes = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    const shift = minutes < 12 * 60 ? 'manhã' : 'tarde';
    const start = shift === 'manhã' ? 7 * 60 : 12 * 60;
    const end = shift === 'manhã' ? 12 * 60 : 17 * 60;
    const capacity = Number(shift === 'manhã' ? doctor.vagas_manha : doctor.vagas_tarde);
    const allowedTurn = doctor.turnos.includes(shift) || doctor.turnos.includes('ambos');
    const slotIndex = (minutes - start) / 15;
    if (!allowedTurn || minutes < start || minutes >= end || slotIndex % 1 !== 0 || slotIndex >= capacity) {
      fail(409, 'O horário não faz parte das vagas disponíveis.');
    }
    const requestId = req.body.idempotency_key ? String(req.body.idempotency_key).slice(0, 120) : null;
    if (requestId) {
      const prior = await client.query(
        `SELECT *, (medico_id=$3 AND data=$4::date AND hora=$5::time) AS same_request
         FROM agendamentos WHERE cliente_request_id=$1 AND paciente_id=$2`,
        [requestId, patientId, doctorId, vaga.data, time]
      );
      if (prior.rows[0]) {
        const appointment = prior.rows[0];
        if (!appointment.same_request) fail(409, 'A chave desta solicitação já foi usada para outro horário.');
        delete appointment.same_request;
        await client.query('COMMIT');
        res.json(appointment);
        return;
      }
    }
    const existing = await client.query(
      `SELECT 1 FROM agendamentos WHERE medico_id=$1 AND data=$2 AND hora=$3 AND status <> 'Cancelado'`,
      [doctorId, vaga.data, time]
    );
    if (existing.rowCount) fail(409, 'Este horário já foi reservado.');
    const result = await client.query(
      `INSERT INTO agendamentos (paciente_id,medico_id,data,hora,cliente_request_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cliente_request_id) DO NOTHING RETURNING *`,
      [patientId, doctorId, vaga.data, time, requestId]
    );
    let appointment = result.rows[0];
    if (!appointment && requestId) {
      const prior = await client.query(
        `SELECT * FROM agendamentos
         WHERE cliente_request_id=$1 AND paciente_id=$2 AND medico_id=$3 AND data=$4 AND hora=$5`,
        [requestId, patientId, doctorId, vaga.data, time]
      );
      appointment = prior.rows[0];
      if (!appointment) fail(409, 'A chave desta solicitação já foi usada para outro horário.');
    }
    if (!appointment) fail(409, 'O horário já está ocupado ou a solicitação já foi utilizada.');
    if (result.rowCount) {
      await audit(client, 'agendamento', appointment.id, 'criar', appointment);
      await client.query(
        `INSERT INTO notificacoes (paciente_id,titulo,mensagem)
         VALUES ($1,'Agendamento solicitado','Sua solicitação de consulta aguarda confirmação da clínica.')`,
        [patientId]
      );
    }
    await client.query('COMMIT');
    if (result.rowCount) {
      emit(req, 'agendamento_update', { id: appointment.id }, { type: 'gestor' });
      emit(req, 'notificacao_nova', { titulo: 'Agendamento solicitado' }, { type: 'paciente', id: patientId });
    }
    res.status(result.rowCount ? 201 : 200).json(appointment);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.post('/agendamentos', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const { paciente_id, medico_id, data, hora } = req.body;
  required(paciente_id, 'Paciente');
  required(medico_id, 'Especialista');
  required(data, 'Data');
  required(hora, 'Horário');
  const { rows } = await pool.query(
    'INSERT INTO agendamentos (paciente_id,medico_id,data,hora) VALUES ($1,$2,$3,$4) RETURNING *',
    [paciente_id, medico_id, data, hora]
  );
  await audit(pool, 'agendamento', rows[0].id, 'criar', rows[0]);
  emit(req, 'agendamento_update', { id: rows[0].id }, { type: 'gestor' });
  res.status(201).json(rows[0]);
}));

router.put('/agendamentos/:id', asyncRoute(async (req, res) => {
  const { status, motivo_cancelamento } = req.body;
  const existing = await pool.query(
    'SELECT paciente_id FROM agendamentos WHERE id=$1',
    [req.params.id]
  );
  if (!existing.rows[0]) fail(404, 'Agendamento não encontrado.');
  if (req.auth.type === 'paciente') {
    if (Number(existing.rows[0].paciente_id) !== Number(req.auth.id)) fail(404, 'Agendamento não encontrado.');
    if (status !== 'Cancelado') fail(403, 'Paciente só pode cancelar o próprio agendamento.');
  }
  if (status && !['Pendente', 'Confirmado', 'Cancelado'].includes(status)) fail(400, 'Status inválido.');
  if (req.auth.type === 'gestor' && status === 'Cancelado' && !motivo_cancelamento) {
    fail(400, 'Informe o motivo do cancelamento.');
  }
  const { rows } = await pool.query(
    `UPDATE agendamentos SET status=COALESCE($2,status),
       motivo_cancelamento=CASE WHEN $2='Cancelado' THEN $3 WHEN $2='Confirmado' THEN NULL ELSE motivo_cancelamento END,
       atualizado_em=NOW()
     WHERE id=$1 RETURNING *`,
    [req.params.id, status || null, req.auth.type === 'paciente' ? 'Cancelado pelo paciente' : motivo_cancelamento || null]
  );
  if (!rows[0]) fail(404, 'Agendamento não encontrado.');
  await audit(pool, 'agendamento', rows[0].id, 'atualizar', req.body);
  const event = await pool.query(
    `SELECT paciente_id,status,data,hora,motivo_cancelamento
     FROM agendamentos WHERE id=$1`,
    [rows[0].id]
  );
  if (status) {
    const patientId = event.rows[0].paciente_id;
    const notification = status === 'Confirmado'
      ? ['Agendamento confirmado', 'Sua consulta foi confirmada pela clínica.']
      : ['Agendamento cancelado', `Sua consulta foi cancelada. Motivo: ${event.rows[0].motivo_cancelamento || 'não informado'}`];
    await pool.query(
      'INSERT INTO notificacoes (paciente_id,titulo,mensagem) VALUES ($1,$2,$3)',
      [patientId, ...notification]
    );
    emit(req, 'notificacao_nova', { titulo: notification[0] }, { type: 'paciente', id: patientId });
  }
  emit(req, 'agendamento_update', { id: rows[0].id }, { type: 'gestor' });
  emit(req, 'agendamento_update', { id: rows[0].id }, { type: 'paciente', id: event.rows[0].paciente_id });
  res.json(rows[0]);
}));

router.delete('/agendamentos/:id', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const result = await pool.query('DELETE FROM agendamentos WHERE id=$1', [req.params.id]);
  if (!result.rowCount) fail(404, 'Agendamento não encontrado.');
  await pool.query(
    "INSERT INTO auditoria (entidade, entidade_id, acao) VALUES ('agendamento', $1, 'excluir')",
    [req.params.id]
  );
  emit(req, 'agendamento_delete', { id: req.params.id }, { type: 'gestor' });
  res.json({ success: true });
}));

router.get('/comunicados', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM comunicados
     WHERE ($2='paciente' AND (setor IS NULL OR setor=$1))
        OR ($2='gestor' AND ($1::text IS NULL OR setor IS NULL OR setor=$1))
     ORDER BY criado_em DESC`,
    [req.auth.type === 'paciente' ? req.auth.setor : req.query.setor || null, req.auth.type]
  );
  res.json(rows);
}));

router.get('/notificacoes', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'paciente') fail(403, 'Notificações são restritas ao paciente.');
  const { rows } = await pool.query(
    `SELECT id,titulo,mensagem,lida_em,criado_em
     FROM notificacoes WHERE paciente_id=$1 ORDER BY criado_em DESC`,
    [req.auth.id]
  );
  res.json(rows);
}));

router.put('/notificacoes/:id/lida', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'paciente') fail(403, 'Notificações são restritas ao paciente.');
  const { rows } = await pool.query(
    `UPDATE notificacoes SET lida_em=COALESCE(lida_em,NOW())
     WHERE id=$1 AND paciente_id=$2 RETURNING id,lida_em`,
    [req.params.id, req.auth.id]
  );
  if (!rows[0]) fail(404, 'Notificação não encontrada.');
  res.json(rows[0]);
}));

router.post('/comunicados', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const { titulo, corpo, mensagem, setor } = req.body;
  required(titulo, 'Título');
  required(corpo || mensagem, 'Mensagem');
  const { rows } = await pool.query(
    'INSERT INTO comunicados (titulo,corpo,setor) VALUES ($1,$2,$3) RETURNING *',
    [titulo.trim(), corpo || mensagem, setor || null]
  );
  const recipients = await pool.query(
    `INSERT INTO notificacoes (paciente_id,titulo,mensagem)
     SELECT id,$1,$2 FROM pacientes WHERE $3::text IS NULL OR setor=$3
     RETURNING paciente_id`,
    [titulo.trim(), corpo || mensagem, setor || null]
  );
  await audit(pool, 'comunicado', rows[0].id, 'criar', rows[0]);
  emit(req, 'comunicado_novo', rows[0], { type: 'gestor' });
  for (const recipient of recipients.rows) {
    req.app.locals.broadcast({
      type: 'notificacao_nova',
      audience: { type: 'paciente', id: recipient.paciente_id },
      payload: { comunicado_id: rows[0].id, titulo: rows[0].titulo, corpo: rows[0].corpo }
    });
  }
  res.status(201).json(rows[0]);
}));

router.put('/comunicados/:id', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const { rows } = await pool.query(
    `UPDATE comunicados SET titulo=COALESCE($2,titulo), corpo=COALESCE($3,corpo),
       setor=COALESCE($4,setor) WHERE id=$1 RETURNING *`,
    [req.params.id, asNullable(req.body.titulo), asNullable(req.body.corpo || req.body.mensagem), req.body.setor ?? null]
  );
  if (!rows[0]) fail(404, 'Comunicado não encontrado.');
  await audit(pool, 'comunicado', rows[0].id, 'atualizar', req.body);
  emit(req, 'comunicado_update', rows[0]);
  res.json(rows[0]);
}));

router.delete('/comunicados/:id', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const result = await pool.query('DELETE FROM comunicados WHERE id=$1', [req.params.id]);
  if (!result.rowCount) fail(404, 'Comunicado não encontrado.');
  await pool.query(
    "INSERT INTO auditoria (entidade, entidade_id, acao) VALUES ('comunicado', $1, 'excluir')",
    [req.params.id]
  );
  emit(req, 'comunicado_delete', { id: req.params.id });
  res.json({ success: true });
}));

router.get('/auditoria', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const { rows } = await pool.query('SELECT * FROM auditoria ORDER BY criado_em DESC LIMIT 1000');
  res.json(rows);
}));

router.post('/auditoria', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  required(req.body.entidade, 'Entidade');
  required(req.body.acao, 'Ação');
  const { rows } = await pool.query(
    `INSERT INTO auditoria (entidade,entidade_id,acao,dados)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [
      String(req.body.entidade).slice(0, 80),
      req.body.entidade_id == null ? null : String(req.body.entidade_id).slice(0, 80),
      String(req.body.acao).slice(0, 500),
      JSON.stringify(req.body.dados || {})
    ]
  );
  res.status(201).json(rows[0]);
}));

router.post('/reset', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'gestor') fail(403, 'Acesso restrito ao gestor.');
  const password = req.body.senha_mestre || req.body.password;
  required(password, 'Senha Mestre');
  const result = await pool.query('SELECT senha_mestre_hash FROM clinica_config WHERE id=1');
  const expected = result.rows[0]?.senha_mestre_hash?.trim();
  if (!expected) fail(409, 'Configure a Senha Mestre antes de redefinir o sistema.');
  const supplied = createHash('sha256').update(String(password)).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(supplied, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) fail(403, 'Senha Mestre incorreta.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE auditoria, notificacoes, agendamentos, pacientes, medicos, comunicados RESTART IDENTITY CASCADE');
    await client.query(
      "UPDATE clinica_config SET nome_clinica='', endereco='', telefone='', senha_mestre_hash=NULL, atualizado_em=NOW() WHERE id=1"
    );
    await client.query("INSERT INTO auditoria (entidade, acao) VALUES ('sistema', 'redefinir')");
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  emit(req, 'system_reset', {}, { type: 'gestor' });
  res.json({ success: true });
}));

module.exports = router;
