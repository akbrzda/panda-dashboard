/**
 * Report Formatter - formatting reports for Telegram
 */

const CHANNEL_ORDER = ["Самовывоз", "Яндекс.Еда", "Доставка", "Зал"];
const CHANNEL_ALIASES = {
  "С собой": "Самовывоз",
  "Доставка самовывоз": "Самовывоз",
};

class ReportFormatter {
  calculateLFL(current, previous) {
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  formatLFL(lfl, digits = 2) {
    if (lfl === null || lfl === undefined) return "N/A";
    return `${lfl > 0 ? "+" : ""}${lfl.toFixed(digits)}%`;
  }

  formatMoney(amount) {
    const value = Number(amount || 0);
    return `${value.toLocaleString("ru-RU", {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ₽`;
  }

  parseRestaurantDisplayName(name) {
    if (!name) return "";

    const match = String(name).match(/\((.+)\)/);
    if (!match?.[1]) return String(name);

    return match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(", ");
  }

  normalizeChannels(channels) {
    const normalized = {};

    for (const [ch, amount] of Object.entries(channels || {})) {
      const source = String(ch || "");
      let name = CHANNEL_ALIASES[source] || source;

      if (source.includes("Яндекс")) {
        name = "Яндекс.Еда";
      } else if (source.includes("самовывоз") || source.includes("С собой")) {
        name = "Самовывоз";
      } else if (source.includes("курьер") || source.includes("Доставка")) {
        name = "Доставка";
      } else if (source.includes("зале") || source.includes("Зал")) {
        name = "Зал";
      }

      normalized[name] = (normalized[name] || 0) + Number(amount || 0);
    }

    return normalized;
  }

  sortChannels(channels) {
    const sorted = {};

    for (const ch of CHANNEL_ORDER) {
      if (channels[ch] !== undefined) sorted[ch] = channels[ch];
    }

    Object.entries(channels)
      .filter(([ch]) => !CHANNEL_ORDER.includes(ch))
      .sort(([, a], [, b]) => b - a)
      .forEach(([ch, amt]) => {
        sorted[ch] = amt;
      });

    return sorted;
  }

  getReportTitle(period) {
    const titles = { week: "за неделю", month: "за месяц", period: "за период", day: "за смену" };
    return `Отчет ${titles[period] || titles.day}`;
  }

  formatReportMessage(data) {
    const {
      restaurantName,
      revenueByChannel,
      totalRevenue,
      totalOrders,
      avgPerOrder,
      date,
      period,
      lfl,
      lflOrders,
      monthlyDiscount,
      previousPeriodRevenue,
      previousPeriodOrders,
    } = data;

    const prevRevenue = Number(previousPeriodRevenue || 0);
    const prevOrders = Number(previousPeriodOrders || 0);
    const prevAvg = prevOrders > 0 ? prevRevenue / prevOrders : 0;
    const avgLfl = this.calculateLFL(avgPerOrder, prevAvg);

    let msg = `${this.getReportTitle(period)} ${date}\n${this.parseRestaurantDisplayName(restaurantName)}\n\n`;

    if (totalOrders > 0) {
      msg += `Заказов: ${Number(totalOrders).toLocaleString("ru-RU")}`;
      if (lflOrders !== null && lflOrders !== undefined && prevOrders > 0) {
        msg += ` (LFL: ${this.formatLFL(lflOrders)} | было: ${prevOrders.toLocaleString("ru-RU")})`;
      }
      msg += "\n";
    }

    if (avgPerOrder > 0) {
      msg += `Средний чек: ${this.formatMoney(avgPerOrder)}`;
      if (avgLfl !== null && avgLfl !== undefined && prevAvg > 0) {
        msg += ` (LFL: ${this.formatLFL(avgLfl)} | было: ${this.formatMoney(prevAvg)})`;
      }
      msg += "\n\n";
    }

    const channels = this.sortChannels(this.normalizeChannels(revenueByChannel));

    msg += "Выручка по каналам:\n";
    for (const [ch, amt] of Object.entries(channels)) {
      msg += `▫️ ${ch}: ${this.formatMoney(amt)}\n`;
    }

    msg += `\nОбщая выручка: ${this.formatMoney(totalRevenue)}`;
    if (lfl !== null && lfl !== undefined && prevRevenue > 0) {
      msg += ` (LFL: ${this.formatLFL(lfl)} | было: ${this.formatMoney(prevRevenue)})`;
    }

    if (monthlyDiscount?.discountPercent !== undefined) {
      msg += `\n\nДисконт: ${Number(monthlyDiscount.discountPercent || 0).toFixed(2)}% (${this.formatMoney(monthlyDiscount.discountSum)})`;
    }

    return msg;
  }
}

module.exports = new ReportFormatter();
