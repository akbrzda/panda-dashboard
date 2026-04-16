const MOSCOW_TZ = "Europe/Moscow";

const pad = (n) => String(n).padStart(2, "0");

function getMoscowDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getMoscowTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { hour: get("hour"), minute: get("minute"), second: get("second") };
}

/**
 * Строит ISO-строки границ OLAP-запроса с учётом московского времени.
 *
 * Если endDateStr совпадает с сегодняшней датой по Москве — верхняя граница
 * устанавливается в текущее московское время (не UTC), чтобы не потерять
 * последние 3 часа заказов.
 *
 * @param {string} startDateStr — дата начала, "YYYY-MM-DD"
 * @param {string} endDateStr   — дата конца,  "YYYY-MM-DD"
 * @returns {{ startIso: string, endIso: string }}
 */
function buildOlapBounds(startDateStr, endDateStr) {
  const startIso = `${startDateStr}T00:00:00Z`;
  const todayMoscow = getMoscowDateString();

  if (endDateStr === todayMoscow) {
    const { hour, minute, second } = getMoscowTimeParts();
    const endIso = `${endDateStr}T${pad(hour)}:${pad(minute)}:${pad(second)}Z`;
    return { startIso, endIso };
  }

  return { startIso, endIso: `${endDateStr}T23:59:59Z` };
}

/**
 * Приводит Date к строке "YYYY-MM-DD" по московскому часовому поясу.
 */
function toMoscowDateStr(date) {
  return getMoscowDateString(date instanceof Date ? date : new Date(date));
}

module.exports = { buildOlapBounds, toMoscowDateStr, getMoscowDateString, getMoscowTimeParts };
