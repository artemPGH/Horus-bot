# Используем легкую версию Node.js
FROM node:18-alpine

# Создаем директорию для приложения
WORKDIR /app

# Копируем файлы с зависимостями
COPY package*.json ./

# Устанавливаем библиотеки (telegraf, dotenv и т.д.)
RUN npm install

# Копируем весь остальной код бота
COPY . .

# Команда для запуска бота
CMD ["node", "index.js"]
