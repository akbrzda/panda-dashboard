require("dotenv").config({ path: ".env" });

const TelegramBot = require("node-telegram-bot-api");
const telegramConfig = require("./config/telegram.config");
const fileLogger = require("./utils/fileLogger");
const scheduler = require("./utils/scheduler");
const telegramService = require("./services/telegramService");
const notificationService = require("./services/notificationService");
const iikoReportService = require("./services/iikoReportService");
const { isAdmin } = require("./utils/auth");

// Проверить конфигурацию
try {
  telegramConfig.validate();
} catch (error) {
  console.error("Config Error:", error.message);
  process.exit(1);
}

const bot = new TelegramBot(telegramConfig.BOT_TOKEN, { polling: true });

// Инициализировать сервисы
telegramService.initialize(bot);
notificationService.initialize(bot);

// Утилита для безопасной отправки сообщений
const sendSafe = async (chatId, text, opts = {}) => {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "HTML", ...opts });
  } catch (e) {
    fileLogger.error(`Send message error: ${e.message}`);
  }
};

// Проверка админа с автоответом
const checkAdmin = async (msg) => {
  if (!isAdmin(msg.from.id)) {
    await sendSafe(msg.chat.id, "❌ Доступ запрещен");
    return false;
  }
  return true;
};

/**
 * /start - приветствие
 */
bot.onText(/\/start/, async (msg) => {
  if (!(await checkAdmin(msg))) return;

  await sendSafe(
    msg.chat.id,
    `
🤖 <b>Panda Dashboard Bot</b>

<b>Команды:</b>
/revenue {id} - Отчет за смену
/revenue {id} {date} - Отчет за дату
/revenue {id} {from} {to} - Отчет за период
/test_daily - Тестовый ежедневный
/test_weekly - Тестовый еженедельный  
/test_monthly - Тестовый ежемесячный
/status - Статус | /help - Справка`
  );
});

/**
 * /status - статус бота
 */
bot.onText(/\/status/, async (msg) => {
  if (!(await checkAdmin(msg))) return;

  const orgs = telegramConfig.getActiveOrganizations();
  await sendSafe(
    msg.chat.id,
    `
✅ <b>Статус</b>

<b>Расписание (МСК):</b> 03:30 / пн 03:35 / 1 число 03:40

<b>Рестораны (${orgs.length}):</b>
${orgs.map((r) => `• ${r.name}`).join("\n")}`
  );
});

/**
 * Универсальный обработчик тестовых отчетов
 */
const handleTestReport = async (msg, type, fetchFn) => {
  if (!(await checkAdmin(msg))) return;

  const chatId = msg.chat.id;
  await sendSafe(chatId, `⏳ Запуск ${type} отчета...`);
  fileLogger.info(`Test ${type} started`, { userId: msg.from.id });

  try {
    const result = await fetchFn();
    if (result.success) {
      await sendSafe(chatId, `✅ ${type} отчет: ${result.successful}/${result.successful + result.failed} | ${result.duration}s`);
      fileLogger.batch(type, result.successful, result.failed, result.duration);
    } else {
      await sendSafe(chatId, `❌ Ошибка: ${result.error}`);
      fileLogger.error(`Test ${type} failed`, { error: result.error });
    }
  } catch (error) {
    await sendSafe(chatId, `❌ Ошибка: ${error.message}`);
    fileLogger.error(`Test ${type} error`, { error: error.message });
  }
};

bot.onText(/^\/test_daily$/, (msg) => handleTestReport(msg, "daily", scheduler.fetchAndSendReports.bind(scheduler)));
bot.onText(/^\/test_weekly$/, (msg) => handleTestReport(msg, "weekly", scheduler.fetchAndSendWeeklyReports.bind(scheduler)));
bot.onText(/^\/test_monthly$/, (msg) => handleTestReport(msg, "monthly", scheduler.fetchAndSendMonthlyReports.bind(scheduler)));

/**
 * /revenue - запрос отчета
 */
bot.onText(/^\/revenue(?:\s+(.+))?$/, async (msg, match) => {
  if (!(await checkAdmin(msg))) return;

  const chatId = msg.chat.id;
  const args = match[1]?.trim().split(/\s+/) || [];
  const orgs = telegramConfig.getActiveOrganizations();

  // Без аргументов - список ресторанов
  if (!args.length) {
    await sendSafe(chatId, `<b>Рестораны:</b>\n${orgs.map((r) => `${r.iikoId} - ${r.name}`).join("\n")}\n\n/revenue {id} [date] [dateTo]`);
    return;
  }

  // Поиск ресторана
  const restaurant = telegramConfig.ORGANIZATIONS.find(
    (org) => org.iikoId.toString() === args[0] || org.name.toLowerCase().includes(args[0].toLowerCase())
  );

  if (!restaurant) {
    await sendSafe(chatId, `❌ Ресторан "${args[0]}" не найден`);
    return;
  }

  if (restaurant.iikoId === 151474) {
    await sendSafe(chatId, `⚠️ ${restaurant.name} исключен из отчетов`);
    return;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const parseDate = (str) => {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  try {
    let reportData, message;

    if (args.length === 1) {
      // Текущая смена
      await sendSafe(chatId, `⏳ Отчет за смену для ${restaurant.name}...`);
      reportData = await iikoReportService.getDailyReportWithLFL(restaurant.iikoId, restaurant.name);
    } else if (args.length === 2 && dateRegex.test(args[1])) {
      // Конкретная дата
      await sendSafe(chatId, `⏳ Отчет для ${restaurant.name} за ${args[1]}...`);
      reportData = await iikoReportService.getDailyReportByDate(restaurant.iikoId, restaurant.name, parseDate(args[1]));
    } else if (args.length >= 3 && dateRegex.test(args[1]) && dateRegex.test(args[2])) {
      // Период
      const start = parseDate(args[1]),
        end = parseDate(args[2]);
      if (start > end) {
        await sendSafe(chatId, `❌ Дата начала должна быть раньше даты конца`);
        return;
      }
      await sendSafe(chatId, `⏳ Отчет для ${restaurant.name} за ${args[1]} - ${args[2]}...`);
      reportData = await iikoReportService.getPeriodReportWithLFL(restaurant.iikoId, restaurant.name, start, end);
      reportData.dayCount = Math.ceil((end - start) / 86400000) + 1;
    } else {
      await sendSafe(chatId, `❌ Формат: /revenue {id} [YYYY-MM-DD] [YYYY-MM-DD]`);
      return;
    }

    message = iikoReportService.formatReportMessage(reportData);
    await sendSafe(chatId, message);
  } catch (error) {
    await sendSafe(chatId, `❌ Ошибка: ${error.message}`);
    fileLogger.error("Revenue command error", { error: error.message });
  }
});

/**
 * /help - справка
 */
bot.onText(/\/help/, async (msg) => {
  if (!(await checkAdmin(msg))) return;

  await sendSafe(
    msg.chat.id,
    `
📖 <b>Справка</b>

<b>Отчеты:</b>
/revenue {id} - за смену
/revenue {id} YYYY-MM-DD - за дату
/revenue {id} from to - за период

<b>Тесты:</b> /test_daily /test_weekly /test_monthly
<b>Инфо:</b> /start /status /help

<b>Расписание:</b>
• Ежедневный: 03:30 (за предыдущую смену)
• Еженедельный: пн 03:35 (за предыдущую неделю)
• Ежемесячный: 1 число 03:40 (за предыдущий месяц)`
  );
});

// Обработчик ошибок
bot.on("error", (error) => fileLogger.error("Bot error", { error: error.message }));

// Запуск планировщика
scheduler.initialize();

console.log("🤖 Bot started | Schedule (MSK): 03:30 daily, Mon 03:35 weekly, day 1 03:40 monthly");
