const telegramConfig = require("../config/telegram.config");

/**
 * Проверить, является ли пользователь администратором
 */
function isAdmin(userId) {
  return telegramConfig.isAdmin(userId);
}

/**
 * Middleware для проверки прав администратора
 * Отправляет сообщение об ошибке, если пользователь не администратор
 */
async function requireAdmin(bot, msg, callback) {
  const userId = msg.from.id;

  if (!isAdmin(userId)) {
    return false;
  }

  return await callback();
}

module.exports = {
  isAdmin,
  requireAdmin,
};
