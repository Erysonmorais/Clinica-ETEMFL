#!/bin/bash

# 🚀 Script de Setup Automático - Clínica ETEMFL

echo "================================"
echo "🏥 CLÍNICA ETEMFL - Setup"
echo "================================"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Passo 1: Verificar Node.js
echo -e "${BLUE}[1/4]${NC} Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado!${NC}"
    echo "Baixe em: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓ Node.js encontrado: $(node --version)${NC}"

# Passo 2: Instalar dependências
echo -e "${BLUE}[2/4]${NC} Instalando dependências npm..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao instalar dependências!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# Passo 3: Verificar/Criar .env
echo -e "${BLUE}[3/4]${NC} Configurando .env..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  .env criado com valores de exemplo!${NC}"
        echo -e "${YELLOW}   Edite .env com suas credenciais do MySQL${NC}"
    else
        cat > .env << 'EOF'
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Emo071427
DB_NAME=clinica_db
PORT=3000
NODE_ENV=development
API_SECRET=seu_secret_super_seguro_aqui
EOF
        echo -e "${YELLOW}⚠️  .env criado com valores padrão!${NC}"
    fi
else
    echo -e "${GREEN}✓ .env já existe${NC}"
fi

# Passo 4: Inicializar banco de dados
echo -e "${BLUE}[4/4]${NC} Inicializando banco de dados..."
npm run init-db
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao inicializar banco!${NC}"
    echo "Verifique:"
    echo "  1. MySQL está rodando?"
    echo "  2. Credenciais em .env estão corretas?"
    exit 1
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ SETUP COMPLETO!${NC}"
echo "================================"
echo ""
echo "Próximos passos:"
echo ""
echo -e "  ${BLUE}npm run dev${NC}"
echo "  Inicia o servidor com nodemon (desenvolvimento)"
echo ""
echo "  ${BLUE}http://localhost:3000/gestor/index.html${NC}"
echo "  Acesse a interface do gestor"
echo ""
echo "  ${BLUE}http://localhost:3000/usuario/index.html${NC}"
echo "  Acesse a interface do usuário"
echo ""
echo "================================"
