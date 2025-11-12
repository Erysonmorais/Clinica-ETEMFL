import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializarBancoDados() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    // Ler o arquivo schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Dividir as queries por ponto e vírgula
    const queries = schema.split(';').filter(q => q.trim() !== '');

    console.log(`Executando ${queries.length} queries...`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i].trim();
      if (query) {
        try {
          await connection.query(query);
          console.log(`✓ Query ${i + 1}/${queries.length} executada`);
        } catch (err) {
          console.error(`Erro na query ${i + 1}:`, err.message);
        }
      }
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
  } finally {
    await connection.end();
  }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initializarBancoDados();
}

export { initializarBancoDados };
