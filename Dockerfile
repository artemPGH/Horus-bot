# ---------- 1. Builder stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Чисто копируем package.json для установки зависимостей
COPY package*.json ./

# Устанавливаем только production-зависимости
RUN npm install --production

# Копируем весь проект
COPY . .

# ---------- 2. Final minimal runtime ----------
FROM node:22-alpine

WORKDIR /app

# Копируем собранные node_modules из builder stage
COPY --from=builder /app/node_modules ./node_modules

# Копируем исходники
COPY --from=builder /app .

# Бот не использует порты — только polling
CMD ["node", "index.js"]
