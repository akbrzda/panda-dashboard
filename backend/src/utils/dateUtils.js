const MOSCOW_TZ = "Europe/Moscow";

const pad = (n) => String(n).padStart(2, "0");

function shiftDateString(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

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
 * Строит границы OLAP-запроса в формате полуинтервала: [start, end).
 *
 * Для iiko ServerAPI это стабильнее, чем передавать текущее время того же дня
 * или значения с суффиксом UTC, из-за которых сервер может вернуть 409/500.
 *
 * @param {string} startDateStr — дата начала, "YYYY-MM-DD"
 * @param {string} endDateStr   — дата конца,  "YYYY-MM-DD"
 * @returns {{ startIso: string, endIso: string }}
 */
function buildOlapBounds(startDateStr, endDateStr) {
  const startIso = `${startDateStr}T00:00:00`;
  const endExclusiveDate = shiftDateString(endDateStr, 1);
  const endIso = `${endExclusiveDate}T00:00:00`;

  return { startIso, endIso };
}

/**
 * Приводит Date к строке "YYYY-MM-DD" по московскому часовому поясу.
 */
function toMoscowDateStr(date) {
  return getMoscowDateString(date instanceof Date ? date : new Date(date));
}

module.exports = { buildOlapBounds, toMoscowDateStr, getMoscowDateString, getMoscowTimeParts };
