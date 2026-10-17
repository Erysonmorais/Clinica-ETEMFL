const { createHash, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { pool } = require('./db');

const scryptAsync = promisify(scrypt);
const SESSION_COOKIES = {
  paciente: 'etemfl_patient_session',
  gestor: 'etemfl_manager_session'
};
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [scheme, salt, expectedHex] = String(encoded || '').split(':');
  if (scheme !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/i.test(expectedHex || '')) return false;
  const actual = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return timingSafeEqual(actual, expected);
}

function cookieOptions(isSecure, type) {
  return [
    `${SESSION_COOKIES[type]}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    ...(isSecure ? ['Secure'] : [])
  ].join('; ');
}

function setSessionCookie(res, token, isSecure, type) {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  res.append('Set-Cookie', [
    `${SESSION_COOKIES[type]}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(isSecure ? ['Secure'] : [])
  ].join('; '));
}

function clearSessionCookie(res, isSecure, type) {
  res.append('Set-Cookie', cookieOptions(isSecure, type));
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  for (const entry of cookieHeader.split(';')) {
    const [key, ...value] = entry.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

async function createSession(type, actorId, res, isSecure) {
  const token = randomBytes(32).toString('base64url');
  const actorColumn = type === 'paciente' ? 'paciente_id' : 'gestor_id';
  await pool.query(
    `INSERT INTO sessoes (token_hash, tipo, ${actorColumn}, expira_em)
     VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
    [hashToken(token), type, actorId]
  );
  setSessionCookie(res, token, isSecure, type);
}

async function authenticateToken(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT s.tipo, p.id AS paciente_id, p.nome AS paciente_nome, p.data_nascimento,
            p.cpf, p.cartao_sus, p.bairro, p.setor, g.id AS gestor_id, g.email
     FROM sessoes s
     LEFT JOIN pacientes p ON p.id=s.paciente_id
     LEFT JOIN gestores g ON g.id=s.gestor_id
     WHERE s.token_hash=$1 AND s.expira_em > NOW()
       AND (s.tipo='paciente' AND p.id IS NOT NULL OR s.tipo='gestor' AND g.ativo=TRUE)`,
    [hashToken(token)]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.tipo === 'paciente') {
    return {
      type: 'paciente',
      id: row.paciente_id,
      nome: row.paciente_nome,
      data_nascimento: row.data_nascimento,
      cpf: row.cpf,
      cartao_sus: row.cartao_sus,
      bairro: row.bairro,
      setor: row.setor
    };
  }
  return { type: 'gestor', id: row.gestor_id, email: row.email };
}

async function requireAuth(req, res, next) {
  try {
    const requestedPortal = req.get('x-etemfl-portal');
    const type = ['paciente', 'gestor'].includes(requestedPortal)
      ? requestedPortal
      : getCookie(req, SESSION_COOKIES.gestor) ? 'gestor' : 'paciente';
    const identity = await authenticateToken(getCookie(req, SESSION_COOKIES[type]));
    if (!identity) return res.status(401).json({ error: 'Autenticação necessária.' });
    req.auth = identity;
    next();
  } catch (error) {
    next(error);
  }
}

function requireManager(req, res, next) {
  if (req.auth?.type !== 'gestor') return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  next();
}

module.exports = {
  SESSION_COOKIES,
  authenticateToken,
  clearSessionCookie,
  createSession,
  getCookie,
  hashPassword,
  requireAuth,
  requireManager,
  verifyPassword
};
