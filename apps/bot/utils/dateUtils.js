/**
 * Утилиты для работы с датами в МСК (Europe/Moscow)
 */

const TIMEZONE = "Europe/Moscow";

/**
 * Преобразовать строку даты (YYYY-MM-DD) из МСК в UTC Date object
 * Пользователь вводит "2025-11-04" - это должно быть день 4 в iiko
 * Возвращаем дату, которая представляет начало дня (00:00 UTC)
 * для запроса в iiko
 *
 * @param {string} dateString - Дата в формате YYYY-MM-DD (что запрашивает пользователь в МСК)
 * @returns {Date} UTC Date object для 00:00 UTC этого дня
 */
function parseMSKDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  return utcDate;
}

/**
 * Форматировать Date как строку в МСК (YYYY-MM-DD)
 *
 * @param {Date} date - UTC Date object
 * @returns {string} Дата в формате YYYY-MM-DD в МСК
 */
function formatMSKDate(date) {
  const parts = date.toLocaleDateString("ru-RU", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [day, month, year] = parts.split(".");
  return `${year}-${month}-${day}`;
}

/**
 * Форматировать Date как строку с временем в МСК (YYYY-MM-DD HH:mm:ss)
 *
 * @param {Date} date - UTC Date object
 * @returns {string} Дата и время в формате YYYY-MM-DD HH:mm:ss в МСК
 */
function formatMSKDateTime(date) {
  const parts = date.toLocaleString("ru-RU", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const [dateStr, timeStr] = parts.split(", ");
  const [day, month, year] = dateStr.split(".");

  return `${year}-${month}-${day} ${timeStr}`;
}

/**
 * Получить текущую дату в МСК (UTC Date object, который представляет начало дня в МСК)
 *
 * @returns {Date} UTC Date object для начала текущего дня в МСК
 */
function getTodayMSK() {
  const now = new Date();
  const mskDateStr = now.toLocaleDateString("ru-RU", { timeZone: TIMEZONE });
  const [day, month, year] = mskDateStr.split(".");
  const dateString = `${year}-${month}-${day}`;

  return parseMSKDate(dateString);
}

/**
 * Получить дату N дней назад от заданной даты
 *
 * @param {Date} date - UTC Date object (00:00 UTC дня)
 * @param {number} daysOffset - Количество дней для смещения (может быть отрицательным)
 * @returns {Date} UTC Date object для начала нужного дня (00:00 UTC)
 */
function addDaysToMSKDate(date, daysOffset) {
  const newDate = new Date(date);
  newDate.setUTCDate(newDate.getUTCDate() + daysOffset);
  return newDate;
}

module.exports = {
  TIMEZONE,
  parseMSKDate,
  formatMSKDate,
  formatMSKDateTime,
  getTodayMSK,
  addDaysToMSKDate,
};
