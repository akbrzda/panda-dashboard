/**
 * Date utilities for reports (Moscow timezone aware)
 */

const REPORT_TIMEZONE = "Europe/Moscow";

const pad = (n) => String(n).padStart(2, "0");

const getTimeZoneParts = (date = new Date(), timeZone = REPORT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

const getTimeZoneDate = (date = new Date(), timeZone = REPORT_TIMEZONE) => {
  const p = getTimeZoneParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
};

const formatDateTimeForOlap = (date, time = "00:00:00") => {
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return `${y}-${m}-${d}T${time}Z`;
};

const getCurrentTimeString = (date = new Date()) => `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;

const getDayBounds = (date) => ({
  start: formatDateTimeForOlap(date, "00:00:00"),
  end: formatDateTimeForOlap(date, "23:59:59"),
  date,
});

const getDateDaysAgo = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
};

const getTodayBounds = (timeZone = REPORT_TIMEZONE) => {
  const nowTz = getTimeZoneDate(new Date(), timeZone);
  return {
    start: formatDateTimeForOlap(nowTz, "00:00:00"),
    end: formatDateTimeForOlap(nowTz, getCurrentTimeString(nowTz)),
    date: nowTz,
  };
};

const getScheduledDailyBounds = (timeZone = REPORT_TIMEZONE) => {
  const nowTz = getTimeZoneDate(new Date(), timeZone);
  const targetDay = getDateDaysAgo(nowTz, 1);
  const compareDay = getDateDaysAgo(targetDay, 7);

  return {
    current: getDayBounds(targetDay),
    previous: getDayBounds(compareDay),
  };
};

const getLastCompletedWeekBounds = (timeZone = REPORT_TIMEZONE) => {
  const nowTz = getTimeZoneDate(new Date(), timeZone);
  const jsDay = nowTz.getUTCDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const lastSunday = getDateDaysAgo(nowTz, isoDay);
  const lastMonday = getDateDaysAgo(lastSunday, 6);

  const prevSunday = getDateDaysAgo(lastMonday, 1);
  const prevMonday = getDateDaysAgo(prevSunday, 6);

  return {
    current: {
      start: formatDateTimeForOlap(lastMonday, "00:00:00"),
      end: formatDateTimeForOlap(lastSunday, "23:59:59"),
      monday: lastMonday,
      sunday: lastSunday,
    },
    previous: {
      start: formatDateTimeForOlap(prevMonday, "00:00:00"),
      end: formatDateTimeForOlap(prevSunday, "23:59:59"),
      monday: prevMonday,
      sunday: prevSunday,
    },
  };
};

const getLastCompletedMonthBounds = (timeZone = REPORT_TIMEZONE) => {
  const nowTz = getTimeZoneDate(new Date(), timeZone);

  const currentFirst = new Date(Date.UTC(nowTz.getUTCFullYear(), nowTz.getUTCMonth() - 1, 1));
  const currentLast = new Date(Date.UTC(nowTz.getUTCFullYear(), nowTz.getUTCMonth(), 0));

  const previousFirst = new Date(Date.UTC(nowTz.getUTCFullYear(), nowTz.getUTCMonth() - 2, 1));
  const previousLast = new Date(Date.UTC(nowTz.getUTCFullYear(), nowTz.getUTCMonth() - 1, 0));

  return {
    current: {
      start: formatDateTimeForOlap(currentFirst, "00:00:00"),
      end: formatDateTimeForOlap(currentLast, "23:59:59"),
      firstDay: currentFirst,
      lastDay: currentLast,
    },
    previous: {
      start: formatDateTimeForOlap(previousFirst, "00:00:00"),
      end: formatDateTimeForOlap(previousLast, "23:59:59"),
      firstDay: previousFirst,
      lastDay: previousLast,
    },
  };
};

const getCurrentWeekBounds = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const toMon = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - toMon);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { start: formatDateTimeForOlap(monday, "00:00:00"), end: formatDateTimeForOlap(sunday, "23:59:59"), monday, sunday };
};

const getPreviousWeekBounds = (currentMonday, currentSunday) => {
  const lastMon = new Date(currentMonday);
  const lastSun = new Date(currentSunday);
  lastMon.setUTCDate(lastMon.getUTCDate() - 7);
  lastSun.setUTCDate(lastSun.getUTCDate() - 7);
  return { start: formatDateTimeForOlap(lastMon, "00:00:00"), end: formatDateTimeForOlap(lastSun, "23:59:59"), monday: lastMon, sunday: lastSun };
};

const getCurrentMonthBounds = () => {
  const now = new Date();
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: formatDateTimeForOlap(firstDay, "00:00:00"), end: formatDateTimeForOlap(lastDay, "23:59:59"), firstDay, lastDay };
};

const getPreviousMonthBounds = () => {
  const now = new Date();
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: formatDateTimeForOlap(firstDay, "00:00:00"), end: formatDateTimeForOlap(lastDay, "23:59:59"), firstDay, lastDay };
};

const formatDateShort = (date) => date.toLocaleDateString("ru-RU", { timeZone: REPORT_TIMEZONE, day: "2-digit", month: "2-digit" });

const formatWeekPeriod = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  return `${pad(s.getUTCDate())}.${pad(s.getUTCMonth() + 1)} - ${pad(e.getUTCDate())}.${pad(e.getUTCMonth() + 1)}`;
};

const getMonthName = (date) => {
  const month = date.toLocaleDateString("ru-RU", { month: "long", timeZone: "UTC" });
  const titleMonth = month.charAt(0).toUpperCase() + month.slice(1);
  return `${titleMonth} ${date.getUTCFullYear()}`;
};

module.exports = {
  REPORT_TIMEZONE,
  pad,
  getTimeZoneParts,
  getTimeZoneDate,
  formatDateTimeForOlap,
  getCurrentTimeString,
  getTodayBounds,
  getDayBounds,
  getCurrentWeekBounds,
  getPreviousWeekBounds,
  getCurrentMonthBounds,
  getPreviousMonthBounds,
  getDateDaysAgo,
  getScheduledDailyBounds,
  getLastCompletedWeekBounds,
  getLastCompletedMonthBounds,
  formatDateShort,
  formatWeekPeriod,
  getMonthName,
};
