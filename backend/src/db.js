const { Pool } = require('pg');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : false
});

pool.on('error', error => {
  console.error('Erro inesperado no pool PostgreSQL:', error);
});

module.exports = { pool };
