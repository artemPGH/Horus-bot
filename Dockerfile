# ---------- 1. Dependencies layer ----------
FROM node:22-alpine AS deps

WORKDIR /app

# Устанавливаем только прод-зависимости по package-lock (быстрый кеш)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit

# ---------- 2. Runtime ----------
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Кладём node_modules из deps-слоя
COPY --from=deps /app/node_modules ./node_modules

# Копируем только нужные файлы приложения
COPY package*.json ./
COPY index.js horus-data.json ./

# Без портов — бот работает через polling
USER node
CMD ["node", "index.js"]
