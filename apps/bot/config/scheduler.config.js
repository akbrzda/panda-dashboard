module.exports = {
  TIMEZONE: "Europe/Moscow",

  // Daily at 00:30 MSK
  DAILY: {
    second: 0,
    minute: 30,
    hour: 0,
  },

  // Weekly on Monday at 00:40 MSK
  WEEKLY: {
    second: 0,
    minute: 35,
    hour: 0,
    dayOfWeek: 1,
  },

  // Monthly on 1st day at 00:50 MSK
  MONTHLY: {
    second: 0,
    minute: 40,
    hour: 0,
    date: 1,
  },

  EXCLUDED_IDS: [151474],

  validate() {
    const errors = [];

    if (!this.TIMEZONE) errors.push("TIMEZONE not set");
    if (!this.DAILY) errors.push("DAILY schedule not set");
    if (!this.WEEKLY) errors.push("WEEKLY schedule not set");
    if (!this.MONTHLY) errors.push("MONTHLY schedule not set");
    if (!Array.isArray(this.EXCLUDED_IDS)) errors.push("EXCLUDED_IDS must be an array");

    if (errors.length > 0) {
      throw new Error("Scheduler config validation failed:\n" + errors.join("\n"));
    }

    return true;
  },
};
