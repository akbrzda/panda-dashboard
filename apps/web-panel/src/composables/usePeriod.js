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

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function subDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function subWeeks(date, weeks) {
  return subDays(date, weeks * 7);
}

function subMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function subYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  // Неделя начинается с понедельника
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function getDateRange(preset, customFrom = null, customTo = null) {
  const today = new Date();

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

    case "custom":
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(today),
        to: customTo ? endOfDay(new Date(customTo)) : endOfDay(today),
      };

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
      return { from: subDays(from, 7), to: subDays(to, 7) };
  }
}

// Форматирование даты в ISO-строку YYYY-MM-DD
export function formatDateISO(date) {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Форматирование даты для отображения пользователю
export function formatDateDisplay(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Получение человекочитаемого описания выбранного периода
export function getPeriodLabel(preset, dateRange) {
  const preset_obj = PERIOD_PRESETS.find((p) => p.value === preset);
  if (preset !== "custom") return preset_obj?.label || "";

  const from = formatDateDisplay(dateRange.from);
  const to = formatDateDisplay(dateRange.to);
  if (from === to) return from;
  return `${from} — ${to}`;
}
