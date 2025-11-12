#!/bin/bash

# Script de deploy para servidor Linux/Ubuntu

set -e

echo "🚀 Iniciando deploy da Clínica ETEMFL..."

# Atualizar sistema
echo "📦 Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
if ! command -v node &> /dev/null; then
    echo "📥 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Instalar MySQL
if ! command -v mysql &> /dev/null; then
    echo "📥 Instalando MySQL..."
    sudo apt install -y mysql-server
fi

# Instalar Nginx
if ! command -v nginx &> /dev/null; then
    echo "📥 Instalando Nginx..."
    sudo apt install -y nginx
fi

# Instalar PM2 globalmente
if ! command -v pm2 &> /dev/null; then
    echo "📥 Instalando PM2..."
    sudo npm install -g pm2
fi

# Clonar ou atualizar projeto
REPO_URL="${1:-https://github.com/seu_usuario/clinica-etemfl.git}"
PROJECT_DIR="/home/ubuntu/clinica-etemfl"

if [ -d "$PROJECT_DIR" ]; then
    echo "📂 Atualizando projeto..."
    cd "$PROJECT_DIR"
    git pull origin main
else
    echo "📂 Clonando projeto..."
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm install --production

# Configurar .env
if [ ! -f .env ]; then
    echo "⚙️ Criando arquivo .env..."
    cp .env.example .env
    echo "⚠️ Edite o arquivo .env com suas credenciais!"
    read -p "Pressione Enter após editar o arquivo .env..."
fi

# Inicializar banco de dados
echo "🗄️ Inicializando banco de dados..."
npm run init-db

# Iniciar com PM2
echo "▶️ Iniciando aplicação com PM2..."
pm2 start app.js --name "clinica-api"
pm2 save
pm2 startup

# Configurar Nginx
echo "⚙️ Configurando Nginx..."
sudo tee /etc/nginx/sites-available/clinica > /dev/null <<EOF
upstream node_app {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://node_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/clinica /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📝 Próximas etapas:"
echo "1. Configure seu domínio no Nginx (edite /etc/nginx/sites-available/clinica)"
echo "2. Instale SSL com: sudo certbot --nginx -d seu_dominio.com"
echo "3. Acesse: http://seu_servidor/gestor/index.html"
echo ""
echo "📊 Comandos úteis:"
echo "   pm2 status              - Ver status da aplicação"
echo "   pm2 logs clinica-api    - Ver logs"
echo "   pm2 restart clinica-api - Reiniciar"
echo ""
