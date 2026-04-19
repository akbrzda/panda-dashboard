const test = require("node:test");
const assert = require("node:assert/strict");

const { toMoscowDateStr, getBusinessDateString } = require("../src/utils/dateUtils");

test("toMoscowDateStr учитывает timezone точки, а не только Москву", () => {
  const timestamp = new Date("2026-04-18T18:30:00Z");

  assert.equal(toMoscowDateStr(timestamp, "Europe/Moscow"), "2026-04-18");
  assert.equal(toMoscowDateStr(timestamp, "Asia/Vladivostok"), "2026-04-19");
});

test("getBusinessDateString учитывает начало операционного дня точки", () => {
  const beforeOperatingDayStart = new Date("2026-04-18T18:30:00Z"); // 04:30 во Владивостоке
  const afterOperatingDayStart = new Date("2026-04-18T20:30:00Z"); // 06:30 во Владивостоке

  assert.equal(getBusinessDateString(beforeOperatingDayStart, "Asia/Vladivostok", "05:00"), "2026-04-18");
  assert.equal(getBusinessDateString(afterOperatingDayStart, "Asia/Vladivostok", "05:00"), "2026-04-19");
});
