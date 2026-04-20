const orderRules = require("./orderRules");
const { toMoscowDateStr } = require("../../utils/dateUtils");

class OrderNormalizer {
  // ─── Флаги OLAP-строк ─────────────────────────────────────────────────────

  isTrueFlag(value) {
    if (value === true || value === 1) return true;
    const flag = String(value ?? "")
      .trim()
      .toUpperCase();
    return flag === "TRUE" || flag === "YES" || flag === "1";
  }

  isDeletedOrderFlag(value) {
    const flag = String(value ?? "")
      .trim()
      .toUpperCase();
    return flag === "DELETED" || flag === "ORDER_DELETED";
  }

  getOrderId(row = {}) {
    return row["UniqOrderId.Id"] || row.OrderId || `${row.OrderNum || "NA"}|${row.OpenTime || ""}|${row.CloseTime || ""}`;
  }

  // ─── Парсинг дат ─────────────────────────────────────────────────────────

  parseDateTime(value) {
    if (!value) return null;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : null;
  }

  parsePossibleDateTime(value) {
    return this.parseDateTime(value);
  }

  toDateOnly(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const isoPart = source.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(isoPart) ? isoPart : null;
  }

  extractDateOnly(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const isoMatch = source.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const ruMatch = source.match(/^(\d{2})[.](\d{2})[.](\d{4})/);
    if (ruMatch) return `${ruMatch[3]}-${ruMatch[2]}-${ruMatch[1]}`;
    return null;
  }

  extractHourLocal(value) {
    const source = String(value || "").trim();
    if (!source) return null;
    const match = source.match(/(?:\s|T)(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  // ─── Временные зоны ───────────────────────────────────────────────────────

  getHourInTimezone(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return null;
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false });
    const hour = Number(formatter.format(new Date(timestamp)));
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
  }

  getWeekdayIndexInTimezone(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return null;
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
    return map[formatter.format(new Date(timestamp))] || null;
  }

  getDateInTimezone(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(timestamp));
    } catch (_) {
      return toMoscowDateStr(new Date(timestamp));
    }
  }

  getWeekdayIndexFromDate(dateStr) {
    if (!dateStr) return null;
    const ts = new Date(`${dateStr}T12:00:00Z`).getTime();
    if (!Number.isFinite(ts)) return null;
    const day = new Date(ts).getUTCDay();
    return day === 0 ? 7 : day;
  }

  // ─── Числа ───────────────────────────────────────────────────────────────

  parseNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  roundMetric(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
  }

  // ─── Выбор значения ───────────────────────────────────────────────────────

  pickFirstValue(row = {}, candidates = []) {
    for (const field of candidates) {
      const value = row[field];
      if (value == null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return null;
  }

  // ─── Нормализация типов заказов ───────────────────────────────────────────

  extractOrderServiceType(row = {}) {
    return this.pickFirstValue(row, ["OrderServiceType", "Order.ServiceType", "OrderServiceType.Name", "Delivery.OrderServiceType"]);
  }

  normalizeOrderServiceType(value) {
    const raw = String(value || "")
      .trim()
      .toUpperCase();
    if (!raw) return "";
    const compact = raw.replace(/[^A-Z]/g, "");
    if (compact === "DELIVERYBYCOURIER") return "DELIVERY_BY_COURIER";
    if (compact === "DELIVERYBYCLIENT") return "DELIVERY_BY_CLIENT";
    if (compact === "COMMON") return "COMMON";
    return raw;
  }

  isCourierDeliveryByServiceType(row = {}) {
    return this.normalizeOrderServiceType(this.extractOrderServiceType(row)) === "DELIVERY_BY_COURIER";
  }

  isDeliveryOrder(row = {}) {
    const courierId = String(row["Delivery.Courier.Id"] || "").trim();
    const orderType = String(row.OrderType || "").toLowerCase();
    return Boolean(courierId) || orderType.includes("достав") || orderType.includes("delivery") || orderType.includes("courier");
  }

  normalizeOrderType(order = {}) {
    const serviceType = this.normalizeOrderServiceType(order.orderServiceType || order.OrderServiceType || "");
    if (serviceType === "DELIVERY_BY_COURIER") return "Доставка курьером";
    if (serviceType === "DELIVERY_BY_CLIENT") return "Самовывоз";
    if (serviceType === "COMMON") return "В зале";
    const orderType = String(order.orderType || order.OrderType || "")
      .trim()
      .toLowerCase();
    if (orderType.includes("достав") || orderType.includes("delivery") || orderType.includes("courier")) return "Доставка курьером";
    if (orderType.includes("самовы") || orderType.includes("pickup") || orderType.includes("takeaway")) return "Самовывоз";
    if (orderType.includes("зал") || orderType.includes("dine")) return "В зале";
    return String(order.orderType || order.OrderType || "Неизвестно");
  }

  normalizeChannelName(channel) {
    const source = String(channel || "")
      .trim()
      .toLowerCase();
    if (!source) return "Неизвестный канал";
    if (source.includes("яндекс") || source.includes("yandex")) return "Яндекс.Еда";
    if (source.includes("самовы") || source.includes("takeaway") || source.includes("pickup")) return "Самовынос";
    if (source.includes("достав") || source.includes("delivery") || source.includes("courier")) return "Доставка";
    if (source.includes("зал") || source.includes("dine")) return "Зал";
    return String(channel || "Прочее");
  }

  normalizeCloudDeliveryStatus(value) {
    return orderRules.getCanonicalDeliveryStatus(value);
  }

  // ─── Номер заказа ─────────────────────────────────────────────────────────

  extractOrderNumber(row = {}) {
    const candidates = [row.OrderNum, row["Order.Num"], row["Order.Number"], row.OrderNumber, row["Delivery.OrderNum"], row["Delivery.OrderNumber"]];
    for (const value of candidates) {
      const normalized = String(value || "").trim();
      if (normalized) return normalized;
    }
    return null;
  }

  formatDisplayOrderNumber(row = {}) {
    return this.extractOrderNumber(row) || "Без номера";
  }

  // ─── Координаты ───────────────────────────────────────────────────────────

  extractCoordinatePairFromRow(row = {}) {
    const lat = this.parseNumber(this.pickFirstValue(row, ["Delivery.Address.Latitude", "DeliveryPoint.Latitude", "Delivery.Latitude", "Latitude"]));
    const lng = this.parseNumber(
      this.pickFirstValue(row, ["Delivery.Address.Longitude", "DeliveryPoint.Longitude", "Delivery.Longitude", "Longitude"]),
    );
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

    const combined = this.pickFirstValue(row, ["Delivery.Address.Coordinates", "DeliveryPoint.Coordinates", "Delivery.Coordinates", "Coordinates"]);
    if (Array.isArray(combined) && combined.length >= 2) {
      const cLng = this.parseNumber(combined[0]);
      const cLat = this.parseNumber(combined[1]);
      if (Number.isFinite(cLat) && Number.isFinite(cLng)) return { lat: cLat, lng: cLng };
    }
    if (typeof combined === "string") {
      const parts = combined
        .split(",")
        .map((v) => this.parseNumber(v.trim()))
        .filter((v) => Number.isFinite(v));
      if (parts.length >= 2) return { lat: parts[1], lng: parts[0] };
    }
    return null;
  }

  // ─── Статус и метрики заказа ─────────────────────────────────────────────

  isCompletedOrderStatus(value) {
    return orderRules.isCompletedStatus(value);
  }

  calculateLateMetrics(order = {}) {
    return orderRules.calculateLateMetrics({ promisedAt: order?.promisedAt, actualDeliveryAt: order?.actualDeliveryAt });
  }

  buildLateOrdersSummary(orders = []) {
    return orderRules.calculateLateOrdersSummary(orders, { round: (v) => this.roundMetric(v) });
  }

  calculateDiscountMetrics({ netRevenue, revenueBeforeDiscount, discountSum }) {
    return orderRules.calculateDiscountMetrics({ netRevenue, revenueBeforeDiscount, discountSum }, (v) => this.roundMetric(v));
  }

  extractPromisedMinutes(row = {}, openAt = null, totalMinutes = null) {
    const minuteFields = [
      row["Delivery.PromisedTimeMinutes"],
      row["Delivery.PromisedDuration"],
      row["Delivery.ExpectedDuration"],
      row["Delivery.ExpectedMinutes"],
      row["OrderTime.PromisedOrderLength"],
    ];
    for (const v of minuteFields) {
      const m = this.parseNumber(v);
      if (m != null && m > 0) return m;
    }
    const dateFields = [
      row["Delivery.PromiseTime"],
      row["Delivery.PromisedTime"],
      row["Delivery.ExpectedCloseTime"],
      row["Delivery.ExpectedDeliveryTime"],
    ];
    for (const v of dateFields) {
      const p = this.parsePossibleDateTime(v);
      if (p && openAt && p >= openAt) return (p - openAt) / (1000 * 60);
    }
    if (totalMinutes != null && totalMinutes > 0) return Math.max(45, Math.min(75, totalMinutes));
    return 60;
  }

  extractOrderStatus(row = {}, order = null) {
    const cancelCause = String(row["Delivery.CancelCause"] || "").trim();
    const isCanceled = this.isDeletedOrderFlag(row.OrderDeleted) || this.isTrueFlag(row.Storned) || Boolean(cancelCause);
    if (isCanceled) return orderRules.getCanonicalDeliveryStatus("canceled");

    const rawServiceType =
      order?.orderServiceType || row.OrderServiceType || row["Order.ServiceType"] || row["OrderServiceType.Name"] || row["Delivery.OrderServiceType"];
    const serviceType = this.normalizeOrderServiceType(rawServiceType);

    const deliveredAt = order?.deliveredAt || this.parseDateTime(row["Delivery.CloseTime"]);
    const sentAt = order?.sentAt || this.parseDateTime(row["Delivery.SendTime"]);
    const cookedAt = order?.cookedAt || this.parseDateTime(row["Delivery.CookingFinishTime"]);

    // Зал/самовывоз считаем завершёнными — нет этапов доставки в модели iiko.
    if (serviceType && serviceType !== "DELIVERY_BY_COURIER") return orderRules.getCanonicalDeliveryStatus("completed");
    if (deliveredAt) return orderRules.getCanonicalDeliveryStatus("completed");
    if (sentAt || cookedAt) return orderRules.getCanonicalDeliveryStatus("in_transit");
    return orderRules.getCanonicalDeliveryStatus("other");
  }

  getStablePoint(seed) {
    const source = String(seed || "point");
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = (hash << 5) - hash + source.charCodeAt(i);
      hash |= 0;
    }
    return { x: 15 + Math.abs(hash % 70), y: 15 + Math.abs((hash * 31) % 70) };
  }

  // ─── Экспорт ─────────────────────────────────────────────────────────────

  escapeXml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  formatTimestampForExport(timestamp, timezone = "Europe/Moscow") {
    if (!timestamp) return "";
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(timestamp));
    } catch (_) {
      return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19);
    }
  }

  formatDurationMinutesForExport(value) {
    const totalMinutes = Number(value);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "00:00:00";
    const totalSeconds = Math.round(totalMinutes * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  buildExcelXmlBuffer({ sheetName, headers, rows }) {
    const safe = this.escapeXml(String(sheetName || "Отчет").slice(0, 31));
    const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${this.escapeXml(h)}</Data></Cell>`).join("");
    const bodyRows = rows
      .map((row) => `<Row>${row.map((v) => `<Cell><Data ss:Type="String">${this.escapeXml(v)}</Data></Cell>`).join("")}</Row>`)
      .join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${safe}">
  <Table>
   <Row>${headerRow}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
    return Buffer.from(xml, "utf8");
  }

  // ─── Нормализация заказов Cloud ───────────────────────────────────────────

  normalizeCloudDeliveryOrders(payload = {}, timezone = "Europe/Moscow") {
    const organizations = Array.isArray(payload?.ordersByOrganizations) ? payload.ordersByOrganizations : [];
    return organizations.flatMap((orgBlock, orgIdx) => {
      const organizationId = String(orgBlock?.organizationId || "").trim();
      const orders = Array.isArray(orgBlock?.orders) ? orgBlock.orders : [];
      return orders.map((item, orderIdx) => {
        const src = item?.order || item || {};
        const createdAt = this.parsePossibleDateTime(src?.whenCreated || src?.createdAt || src?.createdDate);
        const cookedAtRaw = this.parsePossibleDateTime(
          src?.whenCookingCompleted || src?.cookingFinishTime || src?.packedAt || src?.whenPacked || src?.readyAt,
        );
        const sentAt = this.parsePossibleDateTime(src?.whenSended || src?.sentAt);
        const deliveredAt = this.parsePossibleDateTime(src?.whenDelivered || src?.deliveredAt || src?.actualDeliveryDate);
        const promisedAt = this.parsePossibleDateTime(src?.completeBefore || src?.promisedTime || src?.expectedDeliveryDate);
        const cookedAt = cookedAtRaw || sentAt || deliveredAt || null;
        const dateBase = deliveredAt || promisedAt || sentAt || createdAt;

        let routeMinutes = null;
        if (sentAt && deliveredAt && deliveredAt >= sentAt) routeMinutes = (deliveredAt - sentAt) / (1000 * 60);
        let prepMinutes = null;
        if (createdAt && cookedAt && cookedAt >= createdAt) prepMinutes = (cookedAt - createdAt) / (1000 * 60);
        let shelfMinutes = null;
        if (cookedAtRaw && sentAt && sentAt >= cookedAtRaw) shelfMinutes = (sentAt - cookedAtRaw) / (1000 * 60);
        const totalMinutes = createdAt && deliveredAt && deliveredAt > createdAt ? (deliveredAt - createdAt) / (1000 * 60) : null;

        let lat = this.parseNumber(src?.deliveryPoint?.coordinates?.latitude);
        let lng = this.parseNumber(src?.deliveryPoint?.coordinates?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          const coords = src?.deliveryPoint?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            lng = this.parseNumber(coords[0]);
            lat = this.parseNumber(coords[1]);
          }
        }

        const courier = src?.courierInfo?.courier || src?.courier || {};
        const orderServiceType = String(src?.orderType?.orderServiceType || "DELIVERY_BY_COURIER")
          .trim()
          .toUpperCase();
        const rawStatus = String(src?.status || "").trim();

        return {
          orderId: String(item?.id || src?.id || src?.number || `cloud-${orgIdx}-${orderIdx}`),
          orderNumber: String(src?.number || item?.number || "").trim() || null,
          displayOrderNumber: String(src?.number || item?.number || "").trim() || "Без номера",
          orderServiceType: orderServiceType || "DELIVERY_BY_COURIER",
          orderType: String(src?.orderType?.name || "Доставка"),
          courierId: String(courier?.id || "unknown"),
          courierName: String(courier?.name || "Неизвестный курьер"),
          deliveryZoneId: src?.deliveryZoneId || null,
          deliveryZoneName: src?.deliveryZone || null,
          deliveryPoint: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
          terminalGroupId: src?.terminalGroupId ? String(src.terminalGroupId) : null,
          organizationId: organizationId || String(src?.organizationId || ""),
          openAt: createdAt,
          createdAt,
          cookedAt,
          promisedAt,
          deliveredAt,
          actualDeliveryAt: deliveredAt,
          sentAt,
          prepMinutes,
          shelfMinutes,
          routeMinutes,
          totalMinutes,
          revenue: Number(src?.sum || 0),
          rawStatus: rawStatus || null,
          status: orderRules.getCanonicalDeliveryStatus(rawStatus),
          statusCategory: orderRules.resolveOrderStatusCategory(rawStatus),
          sourceKey: src?.sourceKey || null,
          hour: this.getHourInTimezone(dateBase, timezone),
          weekdayIndex: this.getWeekdayIndexInTimezone(dateBase, timezone),
          date: this.getDateInTimezone(dateBase, timezone),
        };
      });
    });
  }

  // ─── Преобразование строк OLAP в заказы ─────────────────────────────────

  toOrderEntities(rows = [], timezone = "Europe/Moscow") {
    const orderMap = new Map();

    rows.forEach((row, idx) => {
      const rawId = String(row["UniqOrderId.Id"] || "").trim();
      const orderId = rawId || `row-${idx}`;
      const orderNumber = this.extractOrderNumber(row);

      if (!orderMap.has(orderId)) {
        const openAt = this.parseDateTime(row.OpenTime);
        const cookedAt = this.parseDateTime(row["Delivery.CookingFinishTime"]);
        const sentAt = this.parseDateTime(row["Delivery.SendTime"]);
        const deliveredAt = this.parseDateTime(row["Delivery.CloseTime"]);
        const promisedAt = this.parsePossibleDateTime(
          this.pickFirstValue(row, [
            "Delivery.ExpectedTime",
            "Delivery.PromiseTime",
            "Delivery.PromisedTime",
            "Delivery.ExpectedDeliveryTime",
            "Delivery.ExpectedCloseTime",
          ]),
        );
        const actualDeliveryAt = this.parsePossibleDateTime(this.pickFirstValue(row, ["Delivery.ActualTime"])) || deliveredAt;
        const routeMinutesRaw = Number(row["Delivery.WayDuration"]) || 0;
        const avgOrderMinutesRaw = Number(row.AverageOrderTime || row["OrderTime.AverageOrderTime"]) || 0;
        const orderLengthRaw = Number(row["OrderTime.OrderLength"]) || 0;

        let routeMinutes = null;
        if (sentAt && deliveredAt && deliveredAt >= sentAt) routeMinutes = (deliveredAt - sentAt) / (1000 * 60);
        else if (routeMinutesRaw > 0) routeMinutes = routeMinutesRaw;

        let prepMinutes = null;
        if (openAt && cookedAt && cookedAt >= openAt) prepMinutes = (cookedAt - openAt) / (1000 * 60);

        let shelfMinutes = null;
        if (cookedAt && sentAt && sentAt >= cookedAt) shelfMinutes = (sentAt - cookedAt) / (1000 * 60);

        let totalMinutes = null;
        if (openAt && deliveredAt && deliveredAt >= openAt) totalMinutes = (deliveredAt - openAt) / (1000 * 60);
        else if (avgOrderMinutesRaw > 0) totalMinutes = avgOrderMinutesRaw;
        else if (orderLengthRaw > 0) totalMinutes = orderLengthRaw;

        const promisedMinutes = this.extractPromisedMinutes(row, openAt, totalMinutes);
        const localDate = this.extractDateOnly(row["OpenDate.Typed"] || row.OpenTime) || this.getDateInTimezone(openAt, timezone);
        const localHour = this.extractHourLocal(row.OpenTime) ?? this.getHourInTimezone(openAt, timezone);
        const localWeekdayIndex = this.getWeekdayIndexFromDate(localDate) || this.getWeekdayIndexInTimezone(openAt, timezone);

        orderMap.set(orderId, {
          orderId,
          orderNumber,
          displayOrderNumber: orderNumber || "Без номера",
          orderType: row.OrderType || "Неизвестно",
          orderServiceType: this.extractOrderServiceType(row) || null,
          channel: this.normalizeChannelName(row.OrderType),
          departmentId: String(row["Department.Id"] || row["Department.Code"] || "").trim() || "unknown",
          departmentName: this.pickFirstValue(row, ["Department", "Department.Name"]) || null,
          courierId: String(row["Delivery.Courier.Id"] || "").trim() || "unknown",
          courierName: String(row["Delivery.Courier"] || "").trim() || "Неизвестный курьер",
          deliveryZoneId: this.pickFirstValue(row, ["Delivery.DeliveryZone.Id", "Delivery.Zone.Id", "DeliveryZone.Id"]) || null,
          deliveryZoneName:
            this.pickFirstValue(row, [
              "Delivery.DeliveryZone",
              "Delivery.DeliveryZone.Name",
              "Delivery.Zone",
              "Delivery.Zone.Name",
              "DeliveryZone",
            ]) || null,
          deliveryPoint: this.extractCoordinatePairFromRow(row),
          rawStatus: this.pickFirstValue(row, ["Delivery.Status", "OrderStatus", "Status"]) || null,
          cancelCause: String(row["Delivery.CancelCause"] || "").trim(),
          isOrderDeleted: this.isDeletedOrderFlag(row.OrderDeleted),
          isStorned: this.isTrueFlag(row.Storned),
          openAt,
          cookedAt,
          sentAt,
          deliveredAt,
          promisedAt,
          actualDeliveryAt,
          prepMinutes,
          shelfMinutes,
          routeMinutes,
          totalMinutes,
          promisedMinutes,
          hour: localHour,
          weekdayIndex: localWeekdayIndex,
          date: localDate,
          revenue: 0,
        });
      }

      const order = orderMap.get(orderId);
      if (!order.orderNumber) {
        order.orderNumber = this.extractOrderNumber(row);
        order.displayOrderNumber = order.orderNumber || "Без номера";
      }
      order.revenue += Number(row.Sales) || 0;
      order.cancelCause = order.cancelCause || String(row["Delivery.CancelCause"] || "").trim();
      order.isOrderDeleted = order.isOrderDeleted || this.isDeletedOrderFlag(row.OrderDeleted);
      order.isStorned = order.isStorned || this.isTrueFlag(row.Storned);
      order.departmentName = order.departmentName || this.pickFirstValue(row, ["Department", "Department.Name"]);
      order.promisedAt =
        order.promisedAt ||
        this.parsePossibleDateTime(
          this.pickFirstValue(row, [
            "Delivery.ExpectedTime",
            "Delivery.PromiseTime",
            "Delivery.PromisedTime",
            "Delivery.ExpectedDeliveryTime",
            "Delivery.ExpectedCloseTime",
          ]),
        );
      order.actualDeliveryAt =
        order.actualDeliveryAt || this.parsePossibleDateTime(this.pickFirstValue(row, ["Delivery.ActualTime"])) || order.deliveredAt;
      order.orderServiceType = order.orderServiceType || this.extractOrderServiceType(row) || null;
      order.deliveryZoneId =
        order.deliveryZoneId || this.pickFirstValue(row, ["Delivery.DeliveryZone.Id", "Delivery.Zone.Id", "DeliveryZone.Id"]) || null;
      order.deliveryZoneName =
        order.deliveryZoneName ||
        this.pickFirstValue(row, ["Delivery.DeliveryZone", "Delivery.DeliveryZone.Name", "Delivery.Zone", "Delivery.Zone.Name", "DeliveryZone"]) ||
        null;
      order.deliveryPoint = order.deliveryPoint || this.extractCoordinatePairFromRow(row);
      order.rawStatus = order.rawStatus || this.pickFirstValue(row, ["Delivery.Status", "OrderStatus", "Status"]) || null;
    });

    return [...orderMap.values()].map((order) => {
      const status = order.isOrderDeleted || order.isStorned || order.cancelCause ? "Отменен" : this.extractOrderStatus({}, order);
      return { ...order, status, statusCategory: orderRules.resolveOrderStatusCategory(status) };
    });
  }
}

module.exports = new OrderNormalizer();
