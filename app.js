import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// 🔗 CONEXÃO COM BANCO REMOTO (Render)
// ==========================
let db;

db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

db.connect(async (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco remoto:', err.message);
    return;
  }

  console.log('✅ Conectado ao banco remoto com sucesso!');
  await initializarBancoDados();

  const createStorageTable = `
    CREATE TABLE IF NOT EXISTS client_storage (
      storage_key VARCHAR(255) PRIMARY KEY,
      storage_value LONGTEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  db.query(createStorageTable, (err) => {
    if (err) console.error('Erro criando tabela client_storage:', err.message);
    else console.log('📦 Tabela client_storage pronta.');
  });
});

// ==========================
// 🔧 Função para criar o banco se não existir
// ==========================
async function initializarBancoDados() {
  const conexaoInicial = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 3306
  });

  conexaoInicial.query(
    `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`,
    (err) => {
      if (err) console.error('Erro criando banco:', err.message);
      else console.log(`📂 Banco ${process.env.DB_NAME} pronto.`);
    }
  );
  conexaoInicial.end();
}

// ==========================
// 🩺 ROTAS DA CLÍNICA
// ==========================

// Rota de teste
app.get('/', (req, res) => {
  res.send('🚀 API da Clínica rodando com sucesso no Render!');
});

// Rota para listar pacientes
app.get('/pacientes', (req, res) => {
  const sql = 'SELECT * FROM pacientes';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erro ao listar pacientes:', err);
      res.status(500).json({ error: 'Erro ao listar pacientes' });
    } else {
      res.json(results);
    }
  });
});

// Rota para cadastrar paciente
app.post('/pacientes', (req, res) => {
  const { nome, nascimento, cpf, sus, bairro, setor, createdBy } = req.body;
  const sql = `
    INSERT INTO pacientes (nome, nascimento, cpf, sus, bairro, setor, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [nome, nascimento, cpf, sus, bairro, setor, createdBy], (err, result) => {
    if (err) {
      console.error('Erro ao cadastrar paciente:', err);
      res.status(500).json({ error: 'Erro ao cadastrar paciente' });
    } else {
      res.json({ id: result.insertId, message: 'Paciente cadastrado com sucesso!' });
    }
  });
});

// Rota para armazenar dados do client_storage (ex: dados locais)
app.post('/storage', (req, res) => {
  const { storage_key, storage_value } = req.body;

  const sql = `
    INSERT INTO client_storage (storage_key, storage_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE storage_value = VALUES(storage_value), updated_at = CURRENT_TIMESTAMP;
  `;

  db.query(sql, [storage_key, storage_value], (err) => {
    if (err) {
      console.error('Erro ao salvar storage:', err);
      res.status(500).json({ error: 'Erro ao salvar dados do storage' });
    } else {
      res.json({ message: 'Dados armazenados com sucesso!' });
    }
  });
});

// Rota para recuperar dados do client_storage
app.get('/storage/:key', (req, res) => {
  const { key } = req.params;
  const sql = 'SELECT storage_value FROM client_storage WHERE storage_key = ?';

  db.query(sql, [key], (err, results) => {
    if (err) {
      console.error('Erro ao buscar storage:', err);
      res.status(500).json({ error: 'Erro ao buscar dados' });
    } else if (results.length === 0) {
      res.status(404).json({ error: 'Chave não encontrada' });
    } else {
      res.json({ storage_key: key, storage_value: results[0].storage_value });
    }
  });
});

// ==========================
// 🚀 Inicialização do servidor
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});
