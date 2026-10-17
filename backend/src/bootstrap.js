const { pool } = require('./db');
const { hashPassword } = require('./auth');

async function bootstrapManager() {
  const email = process.env.GESTOR_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.GESTOR_BOOTSTRAP_PASSWORD;
  if (!email && !password) {
    const { rows } = await pool.query('SELECT EXISTS (SELECT 1 FROM gestores) AS exists');
    if (!rows[0].exists) {
      console.warn('Nenhum gestor existe. Configure GESTOR_BOOTSTRAP_EMAIL e GESTOR_BOOTSTRAP_PASSWORD para criar o primeiro acesso.');
    }
    return;
  }
  if (!email || !password || password.length < 16) {
    throw new Error('Informe GESTOR_BOOTSTRAP_EMAIL e GESTOR_BOOTSTRAP_PASSWORD com pelo menos 16 caracteres.');
  }
  const { rows } = await pool.query('SELECT id FROM gestores LIMIT 1');
  if (rows.length) return;
  await pool.query('INSERT INTO gestores (email, senha_hash) VALUES ($1, $2)', [
    email,
    await hashPassword(password)
  ]);
  console.log(`Acesso inicial de gestor criado para ${email}.`);
}

module.exports = { bootstrapManager };
