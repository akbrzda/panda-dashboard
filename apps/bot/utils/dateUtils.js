const MOSCOW_TZ = "Europe/Moscow";
const TIMEZONE = MOSCOW_TZ;
const DEFAULT_REPORT_TIMEZONE = MOSCOW_TZ;

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

function getDateTimeParts(date = new Date(), timezone = DEFAULT_REPORT_TIMEZONE) {
	const targetDate = date instanceof Date ? date : new Date(date);
	if (!Number.isFinite(targetDate.getTime())) {
		return null;
	}

	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone || DEFAULT_REPORT_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	const parts = formatter.formatToParts(targetDate);
	const get = (type, fallback = "00") => parts.find((part) => part.type === type)?.value || fallback;

	return {
		year: get("year", "1970"),
		month: get("month"),
		day: get("day"),
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

function isBeforeOperatingDayStart(parts, operatingDayStart = "00:00") {
	const { hour, minute } = parseOperatingDayStart(operatingDayStart);
	return parts.hour < hour || (parts.hour === hour && parts.minute < minute);
}

function getDateStringInTimezone(date = new Date(), timezone = DEFAULT_REPORT_TIMEZONE) {
	const parts = getDateTimeParts(date, timezone);
	if (!parts) {
		return "";
	}

	return `${parts.year}-${parts.month}-${parts.day}`;
}

function getTimePartsInTimezone(date = new Date(), timezone = DEFAULT_REPORT_TIMEZONE) {
	const parts = getDateTimeParts(date, timezone);
	if (!parts) {
		return { hour: 0, minute: 0, second: 0 };
	}

	return {
		hour: parts.hour,
		minute: parts.minute,
		second: parts.second,
	};
}

function getBusinessDateString(date = new Date(), timezone = DEFAULT_REPORT_TIMEZONE, operatingDayStart = "00:00") {
	const parts = getDateTimeParts(date, timezone);
	if (!parts) {
		return "";
	}

	const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
	if (isBeforeOperatingDayStart(parts, operatingDayStart)) {
		return shiftDateString(calendarDate, -1);
	}

	return calendarDate;
}

function getMoscowDateString(date = new Date(), timezone = DEFAULT_REPORT_TIMEZONE) {
	return getDateStringInTimezone(date, timezone);
}

function getMoscowTimeParts(date = new Date(), timezone = DEFAULT_REPORT_TIMEZONE) {
	return getTimePartsInTimezone(date, timezone);
}

function buildOlapBounds(startDateStr, endDateStr) {
	return {
		startIso: `${startDateStr}T00:00:00`,
		endIso: `${shiftDateString(endDateStr, 1)}T00:00:00`,
	};
}

function toMoscowDateStr(date, timezone = DEFAULT_REPORT_TIMEZONE) {
	return getMoscowDateString(date instanceof Date ? date : new Date(date), timezone);
}

function parseMSKDate(dateString) {
	const [year, month, day] = String(dateString || "")
		.split("-")
		.map(Number);

	return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function formatMSKDate(date) {
	const parts = new Date(date).toLocaleDateString("ru-RU", {
		timeZone: TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	const [day, month, year] = parts.split(".");
	return `${year}-${month}-${day}`;
}

function formatMSKDateTime(date) {
	const parts = new Date(date).toLocaleString("ru-RU", {
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

function getTodayMSK() {
	const now = new Date();
	const mskDateStr = now.toLocaleDateString("ru-RU", { timeZone: TIMEZONE });
	const [day, month, year] = mskDateStr.split(".");
	return parseMSKDate(`${year}-${month}-${day}`);
}

function addDaysToMSKDate(date, daysOffset) {
	const nextDate = new Date(date);
	nextDate.setUTCDate(nextDate.getUTCDate() + Number(daysOffset || 0));
	return nextDate;
}

module.exports = {
	MOSCOW_TZ,
	TIMEZONE,
	DEFAULT_REPORT_TIMEZONE,
	shiftDateString,
	getDateTimeParts,
	parseOperatingDayStart,
	isBeforeOperatingDayStart,
	getDateStringInTimezone,
	getTimePartsInTimezone,
	getBusinessDateString,
	getMoscowDateString,
	getMoscowTimeParts,
	buildOlapBounds,
	toMoscowDateStr,
	parseMSKDate,
	formatMSKDate,
	formatMSKDateTime,
	getTodayMSK,
	addDaysToMSKDate,
};
