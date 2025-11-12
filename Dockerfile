FROM node:18-alpine

# Diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código
COPY . .

# Expor porta
EXPOSE 3000

# Iniciar servidor
CMD ["npm", "start"]
