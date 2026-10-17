FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend
COPY database ./database
COPY usuario ./usuario
COPY gestor ./gestor
USER node
EXPOSE 3001
CMD ["node", "backend/server.js"]
