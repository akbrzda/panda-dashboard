export const DEFAULT_PERIOD_TIMEZONE = "Europe/Moscow";

// Пресеты периодов для PeriodSelector
export const PERIOD_PRESETS = [
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "current-week", label: "Текущая неделя" },
  { value: "last-week", label: "Прошлая неделя" },
  { value: "current-month", label: "Текущий месяц" },
  { value: "last-month", label: "Прошлый месяц" },
  { value: "custom", label: "Произвольный период" },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function buildUtcDate(year, month, day, endOfDayValue = false) {
  return endOfDayValue
    ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
    : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function parseIsoDate(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return buildUtcDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function getTimezoneParts(date = new Date(), timezone = DEFAULT_PERIOD_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || DEFAULT_PERIOD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type, fallback = "00") => parts.find((part) => part.type === type)?.value || fallback;

  return {
    year: Number(get("year", "1970")),
    month: Number(get("month", "1")),
    day: Number(get("day", "1")),
    hour: Number(get("hour", "0")),
    minute: Number(get("minute", "0")),
    second: Number(get("second", "0")),
  };
}

function parseOperatingDayStart(value = "00:00") {
  const match = String(value || "")
    .trim()
    .match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return { hour: 0, minute: 0 };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 0, minute: 0 };
  }

  return { hour, minute };
}

function getBusinessDate(now = new Date(), timezone = DEFAULT_PERIOD_TIMEZONE, operatingDayStart = "00:00") {
  const parts = getTimezoneParts(now, timezone);
  const operatingStart = parseOperatingDayStart(operatingDayStart);
  const date = buildUtcDate(parts.year, parts.month, parts.day);

  if (parts.hour < operatingStart.hour || (parts.hour === operatingStart.hour && parts.minute < operatingStart.minute)) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return date;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function subDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function subWeeks(date, weeks) {
  return subDays(date, weeks * 7);
}

function subMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function subYears(date, years) {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function startOfYear(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
}

export function getDateRange(preset, customFrom = null, customTo = null, options = {}) {
  const { timezone = DEFAULT_PERIOD_TIMEZONE, operatingDayStart = "00:00", now = new Date() } = options;
  const today = getBusinessDate(now, timezone, operatingDayStart);

  switch (preset) {
    case "today":
      return { from: startOfDay(today), to: endOfDay(today) };

    case "yesterday": {
      const yesterday = subDays(today, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }

    case "current-week":
      return { from: startOfWeek(today), to: endOfDay(today) };

    case "last-week": {
      const prevWeek = subWeeks(today, 1);
      return { from: startOfWeek(prevWeek), to: endOfWeek(prevWeek) };
    }

    case "current-month":
      return { from: startOfMonth(today), to: endOfDay(today) };

    case "last-month": {
      const prevMonth = subMonths(today, 1);
      return { from: startOfMonth(prevMonth), to: endOfMonth(prevMonth) };
    }

    case "current-year":
      return { from: startOfYear(today), to: endOfDay(today) };

    case "custom": {
      const fromDate = parseIsoDate(customFrom) || today;
      const toDate = parseIsoDate(customTo) || today;
      return {
        from: startOfDay(fromDate),
        to: endOfDay(toDate),
      };
    }

    default:
      return { from: startOfDay(today), to: endOfDay(today) };
  }
}

export function getLFLRange(preset, range) {
  const { from, to } = range;
  const diffDays = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;

  switch (preset) {
    case "today":
    case "yesterday":
      return { from: subDays(from, 7), to: subDays(to, 7) };

    case "current-week":
    case "last-week":
      return { from: subWeeks(from, 1), to: subWeeks(to, 1) };

    case "current-month":
    case "last-month":
      return { from: subMonths(from, 1), to: subMonths(to, 1) };

    case "current-year":
      return { from: subYears(from, 1), to: subYears(to, 1) };

    case "custom":
      return { from: subDays(from, diffDays), to: subDays(to, diffDays) };

    default:
      return { from: subDays(from, diffDays), to: subDays(to, diffDays) };
  }
}

export function formatDateISO(date) {
  if (!date) return "";
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "";

  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(date) {
  if (!date) return "";
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "";

  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

export function getPeriodLabel(preset, dateRange) {
  const presetItem = PERIOD_PRESETS.find((item) => item.value === preset);
  if (preset !== "custom") return presetItem?.label || "";

  const from = formatDateDisplay(dateRange.from);
  const to = formatDateDisplay(dateRange.to);
  if (from === to) return from;
  return `${from} — ${to}`;
}
