// index.js
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ====== 1. Настройки ======

// !!! ШАГ 1: после первого запуска возьми свой ID из /whoami и запиши сюда !!!
const ADMIN_IDS = [
    1906257746,7097978555
];

// ссылки
const HORUS_SITE = 'https://artempgh.github.io/Horus-site/';
const HORUS_YOUTUBE = 'https://www.youtube.com/@ArtemStudio-new';
const HORUS_TRAILER = 'https://www.youtube.com/watch?v=ceHUeVh0VdU';

// файл с анкетами и тестами
const DATA_FILE = path.join(__dirname, 'horus-data.json');

// ====== 2. Загрузка/сохранение данных ======

let data = { forms: [], tests: [] };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      data = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Ошибка загрузки horus-data.json:', err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Ошибка сохранения horus-data.json:', err);
  }
}

loadData();

// ====== 3. Состояния пользователей ======

/**
 * sessions: Map<userId, { mode: 'FORM' | 'TEST', step: number, form?, test? }>
 */
const sessions = new Map();

// Вопросы анкеты
const FORM_QUESTIONS = [
  {
    key: 'age',
    text: '1/5. Сколько тебе лет? (можно диапазон, например "14-15")',
  },
  {
    key: 'experience',
    text: '2/5. Расскажи вкратце про свой опыт в Minecraft и на SMP/сюжетных серверах.',
  },
  {
    key: 'find',
    text: '3/5. Как ты узнал про Horus V? (YouTube, друзья, Discord и т.д.)',
  },
  {
    key: 'playtime',
    text: '4/5. В какое время по МСК ты обычно играешь и сколько часов в неделю можешь уделять серверу?',
  },
  {
    key: 'why',
    text: '5/5. Почему именно Horus V? Чем тебе интересен сервер и что ты хочешь привнести?',
  },
];

// Вопросы теста — максимально сложные и развёрнутые
const TEST_QUESTIONS = [
  '1/8. Horus V — это не "просто ванильный сервер". Своими словами опиши, какая у него основная идея и атмосфера.',
  '2/8. Назови минимум три вещи, которые на Horus V важнее доната. Объясни, почему именно они.',
  '3/8. Зачем на сервере существует барьер и поэтапное расширение мира? Почему это важно для сюжета и баланса?',
  '4/8. Гриферство, воровство и читы. Распиши, что из этого однозначно запрещено и как ты поступишь, если увидишь нарушителя.',
  '5/8. Ты случайно нашёл чужую базу без владельца онлайн. Опиши максимально подробно, что ты будешь делать и чего точно не будешь.',
  '6/8. На сервере есть Смотрители и Невидимка. Как ты представляешь их роль в лоре? (важна логика и адекватность, спойлеры не нужны).',
  '7/8. Назови три вещи, которые ты точно не будешь делать на Horus V, даже если будешь уверен, что никто не увидит.',
  '8/8. Придумай идею небольшого сюжетного события или арки, которую ты мог бы реализовать на Horus V вместе с другими игроками.',
];

// ====== 4. Инициализация бота ======

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.error('❌ BOT_TOKEN не найден в .env');
  process.exit(1);
}

const bot = new Telegraf(botToken);

// ====== 5. Хелперы ======

function isAdmin(ctx) {
  return ADMIN_IDS.includes(ctx.from.id);
}

function notifyAdminsAboutForm(form) {
  const lines = [
    `📝 Новая анкета #${form.id}`,
    '',
    `Игрок: ${form.name || '—'} (@${form.username || 'нет юзернейма'})`,
    `ID: ${form.telegramId}`,
    '',
    `Возраст: ${form.age}`,
    `Опыт: ${form.experience}`,
    `Как узнал: ${form.find}`,
    `Онлайн: ${form.playtime}`,
    `Почему Horus V: ${form.why}`,
    '',
    'Чтобы отправить тест этому игроку, введите:',
    `/start_test ${form.telegramId}`,
  ];
  const text = lines.join('\n');

  ADMIN_IDS.forEach((adminId) => {
    bot.telegram.sendMessage(adminId, text).catch(() => {});
  });
}

function notifyAdminsAboutTest(test, fromUser) {
  const headerLines = [
    `📚 Завершён тест #${test.id}`,
    '',
    `Игрок: ${(fromUser.first_name || '')} (@${fromUser.username || 'нет юзернейма'})`,
    `ID: ${test.telegramId}`,
    '',
  ];
  let body = '';

  test.answers.forEach((qa, index) => {
    body += `Вопрос ${index + 1}:\n${qa.question}\nОтвет:\n${qa.answer}\n\n`;
  });

  const msg = headerLines.join('\n') + body;

  ADMIN_IDS.forEach((adminId) => {
    bot.telegram.sendMessage(adminId, msg, {
      disable_web_page_preview: true,
    }).catch(() => {});
  });
}

// ====== 6. Команды общего доступа ======

bot.start((ctx) => {
  const user = ctx.from?.first_name || 'игрок';

  ctx.reply(
    `Привет, ${user}!\n\n` +
      `Ты попал в *официального бота отбора* на сервер **Horus V**.\n\n` +
      `Сейчас отбор идёт в два этапа:\n` +
      `1) Анкета /apply\n` +
      `2) Тест по лору и правилам (высылается только тем, чья анкета прошла первичную проверку).\n\n` +
      `Перед подачей заявки советуем посмотреть сериал и сайт.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('🌐 Сайт Horus V', HORUS_SITE)],
        [Markup.button.url('🎬 Трейлер сериала', HORUS_TRAILER)],
        [Markup.button.url('📺 YouTube-канал', HORUS_YOUTUBE)],
      ]),
    },
  );
});

bot.help((ctx) => {
  ctx.reply(
    'Команды:\n' +
      '/start — приветствие\n' +
      '/apply — подать анкету на участие\n' +
      '/ping — проверить, жив ли бот\n' +
      '/whoami — показать твой Telegram ID\n\n' +
      'Тест по лору высылается вручную после проверки анкеты.',
  );
});

bot.command('ping', (ctx) => ctx.reply('pong 🏓'));

bot.command('whoami', (ctx) => {
  ctx.reply(`Твой Telegram ID: ${ctx.from.id}`);
});

// ====== 7. Анкета игрока (/apply) ======

bot.command('apply', (ctx) => {
  const userId = ctx.from.id;

  if (sessions.has(userId)) {
    return ctx.reply(
      'У тебя уже запущен процесс (анкета или тест). ' +
        'Сначала закончи его, потом запускай /apply снова.',
    );
  }

  const form = {
    telegramId: userId,
    username: ctx.from.username || '',
    name: ctx.from.first_name || '',
    createdAt: new Date().toISOString(),
  };

  sessions.set(userId, {
    mode: 'FORM',
    step: 0,
    form,
  });

  ctx.reply(
    'Запускаем анкету Horus V.\n' +
      'Отвечай честно и развёрнуто — это сильно влияет на решение.\n\n' +
      FORM_QUESTIONS[0].text,
  );
});

// ====== 8. Админ-команда: старт теста для пользователя ======

bot.command('start_test', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('Эта команда доступна только админам.');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply('Использование: /start_test <telegramId игрока>');
  }

  const targetId = Number(parts[1]);
  if (!Number.isInteger(targetId)) {
    return ctx.reply('Неверный ID. Нужен целый номер Telegram ID.');
  }

  // Создаём сессию теста для этого игрока
  sessions.set(targetId, {
    mode: 'TEST',
    step: 0,
    test: {
      telegramId: targetId,
      createdAt: new Date().toISOString(),
      answers: [],
    },
  });

  try {
    await bot.telegram.sendMessage(
      targetId,
      '📘 Ты прошёл первый этап отбора на Horus V.\n\n' +
        'Сейчас будет сложный тест по атмосфере, правилам и лору сервера.\n' +
        'Отвечай развёрнуто, не в одно слово. Чем подробнее — тем лучше мы поймём, подходит ли тебе сервер.\n\n' +
        TEST_QUESTIONS[0],
    );
    ctx.reply(`Тест отправлен игроку с ID ${targetId}.`);
  } catch (err) {
    console.error('Ошибка отправки теста игроку:', err);
    ctx.reply(
      'Не удалось отправить сообщение этому ID. ' +
        'Скорее всего, игрок ни разу не писал боту /start или заблокировал бота.',
    );
  }
});

// ====== 9. Обработка текста (анкета/тест/по умолчанию) ======

bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const session = sessions.get(userId);

  if (!session) {
    // Нет активной анкеты/теста
    return ctx.reply(
      'Я бот отбора на Horus V.\n\n' +
        'Чтобы подать заявку, используй команду /apply.\n' +
        'Доступные команды: /start, /help, /apply, /ping.',
    );
  }

  if (session.mode === 'FORM') {
    handleFormAnswer(ctx, session);
  } else if (session.mode === 'TEST') {
    handleTestAnswer(ctx, session);
  } else {
    ctx.reply('Неожиданное состояние. Попробуй ещё раз /apply.');
  }
});

// ====== 10. Логика анкеты ======

function handleFormAnswer(ctx, session) {
  const step = session.step;
  const question = FORM_QUESTIONS[step];
  const answer = ctx.message.text.trim();

  session.form[question.key] = answer;
  session.step++;

  if (session.step < FORM_QUESTIONS.length) {
    const nextQuestion = FORM_QUESTIONS[session.step];
    ctx.reply(nextQuestion.text);
  } else {
    // Анкета завершена
    sessions.delete(ctx.from.id);

    const lastId = data.forms.length > 0 ? data.forms[data.forms.length - 1].id : 0;
    const form = {
      id: lastId + 1,
      status: 'waiting_review',
      ...session.form,
    };

    data.forms.push(form);
    saveData();

    ctx.reply(
      '📨 Анкета отправлена на проверку!\n' +
        'Мы просмотрим её вручную. Если ты подойдёшь по формату, сюда придёт тест по Horus V.\n\n' +
        'Спасибо за интерес к серверу.',
    );

    notifyAdminsAboutForm(form);
  }
}

// ====== 11. Логика теста ======

function handleTestAnswer(ctx, session) {
  const step = session.step;
  const questionText = TEST_QUESTIONS[step];
  const answer = ctx.message.text.trim();

  session.test.answers.push({
    question: questionText,
    answer,
  });

  session.step++;

  if (session.step < TEST_QUESTIONS.length) {
    const nextQ = TEST_QUESTIONS[session.step];
    ctx.reply(nextQ + '\n\n(Пожалуйста, отвечай развёрнуто.)');
  } else {
    // Тест завершён
    sessions.delete(ctx.from.id);

    const lastId = data.tests.length > 0 ? data.tests[data.tests.length - 1].id : 0;
    const test = {
      id: lastId + 1,
      ...session.test,
    };

    data.tests.push(test);
    saveData();

    ctx.reply(
      '✅ Тест отправлен на проверку.\n' +
        'Ответы будут внимательно прочитаны вручную. Если ты подойдёшь серверу, админ напишет тебе лично в Telegram.',
    );

    notifyAdminsAboutTest(test, ctx.from);
  }
}

// ====== 12. Запуск бота ======

bot.launch().then(() => {
  console.log('🤖 Horus Bot запущен (анкета + тест)…');
});

// корректная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

