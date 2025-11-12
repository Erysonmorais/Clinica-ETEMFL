import express from 'express';
import mysql from 'mysql2';
import dotenv from 'dotenv';
import { queries } from './queries.js';
import { initializarBancoDados } from './initDb.js';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
app.use(express.json());
// Servir arquivos estáticos da pasta clinica (frontend)
app.use(express.static('clinica'));

let db; // Variável global para a conexão com o banco

// Conexão inicial (sem banco específico)
const conexaoInicial = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
});

// Criar banco de dados se não existir
conexaoInicial.connect(async function(erro){
    if(erro) throw erro;
    console.log('Conectado ao MySQL!');
    
    // Inicializar banco de dados com schema
    await initializarBancoDados();
    
    conexaoInicial.end();
    
    // Agora conectar ao banco específico
    db = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'clinica_db'
    });
    
    db.connect(function(erro){
        if(erro) throw erro;
        console.log('Conectado ao banco clinica_db com sucesso!');
        // Garantir tabela para armazenamento de chaves/valores do cliente
        const createStorageTable = `CREATE TABLE IF NOT EXISTS client_storage (
            storage_key VARCHAR(255) PRIMARY KEY,
            storage_value LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
        db.query(createStorageTable, (err) => {
            if(err) console.error('Erro criando tabela client_storage:', err.message);
            else console.log('Tabela client_storage pronta.');
        });
    });
});

// ===== ROTAS =====

app.get('/', function(req, res) {  
    res.json({ mensagem: 'API Clínica ETEMFL', versao: '1.0.0' });
});

// --- Endpoints simples para armazenamento key/value (compatibilidade com front-end que usava localStorage)
app.get('/storage/all', (req, res) => {
    db.query('SELECT storage_key, storage_value FROM client_storage', (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        const out = {};
        results.forEach(r => {
            try { out[r.storage_key] = JSON.parse(r.storage_value); } catch(e) { out[r.storage_key] = r.storage_value; }
        });
        res.json(out);
    });
});

app.get('/storage/:key', (req, res) => {
    const key = req.params.key;
    db.query('SELECT storage_value FROM client_storage WHERE storage_key = ?', [key], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        if(!results || results.length === 0) return res.status(404).json({ mensagem: 'not found' });
        try { return res.json(JSON.parse(results[0].storage_value)); } catch(e) { return res.json(results[0].storage_value); }
    });
});

app.post('/storage/:key', (req, res) => {
    const key = req.params.key;
    const value = JSON.stringify(req.body.value === undefined ? req.body : req.body.value);
    db.query('INSERT INTO client_storage (storage_key, storage_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE storage_value = VALUES(storage_value), updated_at = CURRENT_TIMESTAMP', [key, value], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'ok' });
    });
});

app.delete('/storage/:key', (req, res) => {
    const key = req.params.key;
    db.query('DELETE FROM client_storage WHERE storage_key = ?', [key], (err) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'deleted' });
    });
});

// Agendamentos por período
app.get('/agendamentos/periodo/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    const { dataInicio, dataFim } = req.query;
    
    db.query(queries.agendamentosPorPeriodo, [pacienteId, dataInicio, dataFim], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Todos os agendamentos do paciente
app.get('/agendamentos/paciente/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    
    db.query(queries.todosAgendamentos, [pacienteId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Agendamentos futuros
app.get('/agendamentos/futuros/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    
    db.query(queries.agendamentosFuturos, [pacienteId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Histórico por período
app.get('/historico/periodo/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    const { dataInicio, dataFim } = req.query;
    
    db.query(queries.historicoPorPeriodo, [pacienteId, dataInicio, dataFim], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Histórico completo
app.get('/historico/paciente/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    
    db.query(queries.historicoCompleto, [pacienteId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Últimas ações
app.get('/historico/ultimas/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    
    db.query(queries.ultimasAcoes, [pacienteId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Vagas pendentes
app.get('/vagas/pendentes', (req, res) => {
    db.query(queries.vagasPendentes, (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Dias da vaga
app.get('/vaga/:vagaId/dias', (req, res) => {
    const { vagaId } = req.params;
    
    db.query(queries.diasVaga, [vagaId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Especialidades ativas
app.get('/especialidades', (req, res) => {
    db.query(queries.especialidadesAtivas, (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Médicos por especialidade
app.get('/medicos', (req, res) => {
    db.query(queries.medicosPorEspecialidade, (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Dados do paciente
app.get('/paciente/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    
    db.query(queries.dadosPaciente, [pacienteId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results[0] || null);
    });
});

// Comunicados por setor
app.get('/comunicados/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    
    db.query(queries.comunicadosPorSetor, [pacienteId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results);
    });
});

// Detalhes do agendamento
app.get('/agendamento/:agendamentoId', (req, res) => {
    const { agendamentoId } = req.params;
    
    db.query(queries.detalhesAgendamento, [agendamentoId], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json(results[0] || null);
    });
});

// Inserir paciente
app.post('/paciente', (req, res) => {
    const { nome, cpf, cartao_sus, data_nascimento, telefone, email, bairro_id, observacoes } = req.body;
    
    db.query(queries.inserirPaciente, [nome, cpf, cartao_sus, data_nascimento, telefone, email, bairro_id, observacoes], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.status(201).json({ id: results.insertId, mensagem: 'Paciente inserido com sucesso' });
    });
});

// Inserir agendamento
app.post('/agendamento', (req, res) => {
    const { vaga_id, paciente_id, criado_por } = req.body;
    
    db.query(queries.inserirAgendamento, [vaga_id, paciente_id, criado_por], (err, results) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.status(201).json({ id: results.insertId, mensagem: 'Agendamento inserido com sucesso' });
    });
});

// Atualizar paciente
app.put('/paciente/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    const { nome, telefone, email, bairro_id, observacoes } = req.body;
    
    db.query(queries.atualizarPaciente, [nome, telefone, email, bairro_id, observacoes, pacienteId], (err) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Paciente atualizado com sucesso' });
    });
});

// Cancelar agendamento
app.put('/agendamento/:agendamentoId/cancelar', (req, res) => {
    const { agendamentoId } = req.params;
    const { motivo, paciente_id } = req.body;
    
    db.query(queries.cancelarAgendamento, [motivo, agendamentoId, paciente_id], (err) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Agendamento cancelado com sucesso' });
    });
});

// Desativar paciente
app.delete('/paciente/:pacienteId', (req, res) => {
    const { pacienteId } = req.params;
    
    db.query(queries.desativarPaciente, [pacienteId], (err) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Paciente desativado com sucesso' });
    });
});

// Deletar agendamento pendente
app.delete('/agendamento/:agendamentoId', (req, res) => {
    const { agendamentoId } = req.params;
    const { paciente_id } = req.body;
    
    db.query(queries.deletarAgendamento, [agendamentoId, paciente_id], (err) => {
        if(err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: 'Agendamento deletado com sucesso' });
    });
});

app.listen(3000, () => {
    const port = process.env.PORT || 3000;
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});