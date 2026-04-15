/**
 * Report Formatter - formatting reports for Telegram
 */

const CHANNEL_ORDER = ["Доставка", "Самовынос", "Зал", "Яндекс.Еда"];
const CHANNEL_ALIASES = {
  "С собой": "Самовынос",
  "Доставка самовывоз": "Самовынос",
  Самовывоз: "Самовынос",
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

  normalizeChannelName(channel) {
    const source = String(channel || "").trim();
    const normalizedSource = source.toLowerCase();

    if (normalizedSource.includes("яндекс")) {
      return "Яндекс.Еда";
    }

    if (
      normalizedSource.includes("самовывоз") ||
      normalizedSource.includes("самовынос") ||
      normalizedSource.includes("с собой") ||
      normalizedSource.includes("доставка самовывоз")
    ) {
      return "Самовынос";
    }

    if (normalizedSource.includes("достав") || normalizedSource.includes("курьер")) {
      return "Доставка";
    }

    return "Зал";
  }

  normalizeChannels(channels) {
    const normalized = {};

    for (const [ch, amount] of Object.entries(channels || {})) {
      const name = this.normalizeChannelName(CHANNEL_ALIASES[ch] || ch);
      normalized[name] = (normalized[name] || 0) + Number(amount || 0);
    }

    return normalized;
  }

  buildChannelStats(revenueByChannel, ordersByChannel) {
    const normalizedRevenue = this.normalizeChannels(revenueByChannel);
    const normalizedOrders = this.normalizeChannels(ordersByChannel);
    const stats = {};

    for (const channel of new Set([...Object.keys(normalizedRevenue), ...Object.keys(normalizedOrders)])) {
      const revenue = Number(normalizedRevenue[channel] || 0);
      const orders = Number(normalizedOrders[channel] || 0);

      stats[channel] = {
        revenue,
        orders,
        avgCheck: orders > 0 ? revenue / orders : 0,
      };
    }

    return stats;
  }

  sortChannels(channels) {
    const sorted = {};

    for (const ch of CHANNEL_ORDER) {
      if (channels[ch] !== undefined) sorted[ch] = channels[ch];
    }

    Object.entries(channels)
      .filter(([ch]) => !CHANNEL_ORDER.includes(ch))
      .sort(([, a], [, b]) => Number(b?.revenue || b || 0) - Number(a?.revenue || a || 0))
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
      ordersByChannel,
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

    const channels = this.sortChannels(this.buildChannelStats(revenueByChannel, ordersByChannel));

    msg += "Выручка по каналам:\n";
    for (const [ch, stats] of Object.entries(channels)) {
      msg += `▫️ ${ch}: ${this.formatMoney(stats.revenue)} | ${Number(stats.orders).toLocaleString("ru-RU")} зак.\n`;
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
