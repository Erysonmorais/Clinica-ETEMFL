require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { WebSocketServer, WebSocket } = require('ws');
const api = require('./src/routes/api');
const { pool } = require('./src/db');
const { authenticateToken, getCookie, SESSION_COOKIES } = require('./src/auth');
const { bootstrapManager } = require('./src/bootstrap');
const openapi = require('./openapi.json');

const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocketServer({ server, path: '/ws' });
const root = path.resolve(__dirname, '..');

app.locals.broadcast = message => {
  const payload = JSON.stringify(message);
  for (const client of webSocketServer.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    const audience = message.audience;
    if (audience?.type === 'gestor' && client.identity?.type !== 'gestor') continue;
    if (audience?.type === 'paciente' &&
        (client.identity?.type !== 'paciente' || String(client.identity.id) !== String(audience.id))) continue;
    client.send(payload);
  }
};

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.get('/gestor/', (req, res) => res.sendFile(path.join(root, 'gestor', 'index_g.html')));
app.use('/usuario', express.static(path.join(root, 'usuario')));
app.use('/gestor', express.static(path.join(root, 'gestor')));
app.get('/', (req, res) => res.redirect('/usuario/'));
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === '23505') return res.status(409).json({ error: 'Registro duplicado.' });
  if (error.code === '23503') return res.status(400).json({ error: 'Referência inválida.' });
  if (error.code === '23514' || error.code === '22P02') return res.status(400).json({ error: 'Dados inválidos.' });
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno do servidor.' });
});

webSocketServer.on('connection', async (socket, request) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const portal = url.searchParams.get('portal');
    if (!['paciente', 'gestor'].includes(portal)) {
      socket.close(1008, 'Portal inválido');
      return;
    }
    const token = getCookie(request, SESSION_COOKIES[portal]);
    socket.identity = await authenticateToken(token);
    if (!socket.identity || socket.identity.type !== portal) {
      socket.close(1008, 'Autenticação necessária');
      return;
    }
    const { rows } = await pool.query('SELECT * FROM clinica_config WHERE id=1');
    socket.send(JSON.stringify({ type: 'init', gestores: rows.map(row => ({
      id: row.id,
      nome_clinica: row.nome_clinica,
      endereco: row.endereco,
      telefone: row.telefone
    })) }));
  } catch (error) {
    console.error('Falha ao enviar configuração inicial pelo WebSocket:', error);
    socket.close(1011, 'Falha ao carregar configuração');
  }
});

const port = Number(process.env.PORT || 3001);
async function start() {
  const schema = await fs.readFile(path.join(root, 'database', 'schema.sql'), 'utf8');
  await pool.query(schema);
  await bootstrapManager();
  server.listen(port, () => console.log(`Clínica ETEMFL disponível em http://localhost:${port}`));
}

async function shutdown() {
  server.close();
  webSocketServer.close();
  await pool.end();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(error => {
  console.error('Não foi possível iniciar a Clínica ETEMFL:', error);
  process.exitCode = 1;
});
