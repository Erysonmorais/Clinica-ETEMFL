# Clínica ETEMFL

Aplicação clínica com portal PWA para pacientes, portal administrativo, API REST, PostgreSQL e WebSocket. O banco é a fonte central dos cadastros; o `localStorage` dos portais funciona somente como cache/offline parcial.

## Estrutura

```text
backend/
  openapi.json             Especificação OpenAPI 3
  server.js                Express, arquivos web e WebSocket
  src/
    auth.js                Hashes, cookies e sessões
    bootstrap.js           Provisionamento inicial do gestor
    db.js                  Pool PostgreSQL
    routes/api.js          Rotas, validação e regras da aplicação
database/
  schema.sql               Esquema relacional idempotente
  seed.sql                 Configuração institucional, sem pacientes ou médicos
gestor/                    Portal administrativo e PWA
usuario/                   Portal do paciente e PWA
scripts/build-netlify.js   Gera a publicação estática com os dois portais
netlify.toml               Configuração de build e diretório público da Netlify
Dockerfile
docker-compose.yml
```

## O que fica persistido

- Clínica e hash SHA-256 da Senha Mestre.
- Gestores (e-mail e hash scrypt da senha), sessões com tokens guardados somente como hash.
- Pacientes, médicos, horários, agendamentos, comunicados, notificações/leitura e auditoria.
- A confirmação/cancelamento de uma consulta cria notificação no banco e envia evento WebSocket para o paciente correspondente; comunicados são direcionados por setor.
- A chave de idempotência de uma solicitação evita duplicar agendamentos quando a sincronização offline repete uma operação.

CPF e Cartão SUS são dados pessoais: não use dados reais em demonstrações, logs ou ambientes de teste.

## Inicialização local (PostgreSQL instalado)

1. Crie um banco PostgreSQL e um usuário dedicado, com senha forte.
2. Copie `.env.example` para `.env`. Configure `DATABASE_URL`, `GESTOR_BOOTSTRAP_EMAIL` e `GESTOR_BOOTSTRAP_PASSWORD` (senha aleatória com pelo menos 16 caracteres).
3. Execute `npm install` e depois `npm start`. Na inicialização, a aplicação aplica `database/schema.sql`, que é idempotente. O arquivo `database/seed.sql` é mantido sem médicos de exemplo e sem pacientes, para não expor dados fictícios ou pessoais.
4. Acesse `http://localhost:3001/usuario/`, `http://localhost:3001/gestor/` e `http://localhost:3001/api-docs/`.

O primeiro início cria a conta de gestor informada no ambiente, somente se ainda não houver gestor cadastrado. Guarde as credenciais fora do código. Para PostgreSQL gerenciado com TLS, configure `PGSSL=true`.

`GET /api/health` verifica API e banco. As conexões WebSocket autenticadas usam `/ws?portal=paciente` ou `/ws?portal=gestor`.

## Inicialização e deploy com Docker Compose

1. Copie `.env.example` para `.env`.
2. Defina `POSTGRES_PASSWORD` (senha aleatória forte), `GESTOR_BOOTSTRAP_EMAIL` e `GESTOR_BOOTSTRAP_PASSWORD` (mínimo 16 caracteres).
3. Execute `docker compose up --build -d`.
4. Verifique `docker compose ps` e `http://localhost:3001/api/health`.
5. Coloque um proxy HTTPS (por exemplo, Caddy ou Nginx) à frente do serviço antes de permitir acesso externo; configure os cabeçalhos de proxy corretos.

O volume de dados é `etemfl-data`. Os arquivos SQL de inicialização são aplicados automaticamente apenas quando o volume do PostgreSQL é criado pela primeira vez. Para atualizar um banco já existente, faça backup e aplique o `database/schema.sql` revisado. **Não remova o volume para atualizar o esquema**: isso apaga os dados.

No Windows, `.\scripts\deploy.ps1` valida os parâmetros obrigatórios e constrói/inicia os serviços.

## Publicação dos portais na Netlify

O projeto `clinica-etemfl` existente está conectado ao repositório GitHub `Erysonmorais/Clinica-ETEMFL`. A configuração da Netlify apontava para uma pasta `clinica/` que não existe; `netlify.toml` corrige o build para gerar e publicar apenas `dist/`, contendo a página inicial e os dois portais. O backend, o esquema SQL e outros arquivos internos não são enviados ao site estático.

Depois que as alterações forem enviadas para `main`, a Netlify publica automaticamente:

- `https://clinica-etemfl.netlify.app/` — entrada com acesso aos dois portais.
- `https://clinica-etemfl.netlify.app/usuario/` — portal do paciente.
- `https://clinica-etemfl.netlify.app/gestor/` — portal do gestor.

O arquivo `netlify.toml` encaminha `/api/*` ao serviço Node.js exclusivo `etemfl-backend.onrender.com`; assim, os portais usam a mesma origem Netlify para autenticação por cookie. O serviço Render está ligado ao PostgreSQL exclusivo `etemfl-clinica` no Neon. No acesso pela Netlify, os portais sincronizam os dados autenticados periodicamente; acessando o servidor Render diretamente, o WebSocket permanece disponível.

**Limites importantes:** a API gratuita do Render pode suspender-se por inatividade, e o banco Neon Free pode pausar quando ocioso e está destinado a protótipos/demonstrações. Não há garantia de disponibilidade nem adequação para produção clínica. Não publique dados reais de saúde numa demonstração; use backups e planos adequados antes de qualquer operação clínica.

## Publicação de demonstração gratuita no Render

O arquivo `render.yaml` configura um serviço Docker gratuito e um PostgreSQL gratuito na mesma região, sem carregar o `seed.sql`. Na primeira inicialização, a API instala o esquema vazio e cria o gestor usando as variáveis secretas fornecidas durante a criação do Blueprint.

1. Crie um repositório GitHub para o projeto e envie os arquivos do workspace; não envie `.env` nem credenciais.
2. No Render, escolha **New > Blueprint** e conecte o repositório.
3. Revise o Blueprint e mantenha os planos **Free**. Informe `GESTOR_BOOTSTRAP_EMAIL` e `GESTOR_BOOTSTRAP_PASSWORD` (mínimo de 16 caracteres) quando solicitado; não use a senha de nenhum outro serviço.
4. Inicie a implantação e acompanhe os registros de construção. Quando terminar, teste `/api/health`, `/usuario/`, `/gestor/` e `/api-docs/` no endereço `onrender.com`.

**Limites importantes:** esta configuração é exclusivamente para demonstração, sem dados reais de pacientes. O serviço gratuito pode suspender-se após inatividade e levar cerca de um minuto para voltar. O PostgreSQL gratuito tem limite de 1 GB, não oferece cópias de segurança e expira 30 dias após a criação; após mais 14 dias, os dados são apagados. Não há garantia de disponibilidade nem adequação para produção clínica. Não mude os serviços para planos pagos se quiser manter o uso sem custo; limites de uso da plataforma também podem interromper a demonstração.

## PWA e operação offline

Cada portal tem seu próprio manifest, ícones e Service Worker. HTTPS é necessário para instalação PWA fora de `localhost`. O cache permite abrir a estrutura previamente carregada sem conexão; consultas e gravações só sincronizam quando a API voltar a estar disponível. As novas solicitações de agendamento são repetidas com chave idempotente. As sessões dos portais usam cookies distintos (`etemfl_patient_session` e `etemfl_manager_session`), e a conexão autenticada WebSocket recebe o portal em `/ws?portal=paciente` ou `/ws?portal=gestor`.

Os caches locais do gestor usam chaves próprias, separadas das chaves do paciente. Na primeira abertura após a atualização, os valores antigos do gestor são copiados para as novas chaves sem apagar os dados legados.

## Contas e segurança

- Pacientes criam conta com CPF, Cartão SUS e senha (mínimo 8 caracteres); a senha é derivada com scrypt e o login cria cookie `HttpOnly`, `SameSite=Strict`.
- O primeiro gestor é criado no bootstrap através de variáveis de ambiente; não existe senha padrão embutida.
- Rotas administrativas exigem sessão de gestor. O paciente só pode consultar o próprio perfil, agendamentos e notificações, cancelar os próprios agendamentos e ler comunicados do seu setor.
- A Senha Mestre é enviada como SHA-256 e comparada no servidor para reset; o hash nunca é retornado ao portal.
- Para uso real, mantenha o sistema em HTTPS, faça backups PostgreSQL testados, defina política de retenção e revise requisitos legais de dados de saúde, controle de acesso, auditoria e resposta a incidentes. Não exponha PostgreSQL à internet.

## Dados de demonstração e migração

`database/seed.sql` não contém especialistas de exemplo nem pacientes. Cadastros de pacientes legados mantidos no navegador podem ser migrados pelo próprio paciente ao entrar com a senha antiga no mesmo navegador, ou pelo gestor na tela de pacientes informando uma nova senha inicial. Confirme cada migração antes de apagar qualquer cópia local.
