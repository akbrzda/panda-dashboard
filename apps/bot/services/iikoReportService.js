/**
 * iiko Report Service
 * Этот файл сохранен для обратной совместимости.
 * Вся логика перенесена в модульную структуру /services/iiko/
 *
 * Модули:
 * - iiko/client.js - HTTP клиент и аутентификация
 * - iiko/olapBuilder.js - построение OLAP запросов
 * - iiko/olapParser.js - парсинг ответов OLAP
 * - iiko/dateUtils.js - утилиты для работы с датами
 * - iiko/reportFormatter.js - форматирование отчетов
 * - iiko/index.js - главный модуль (фасад)
 */

module.exports = require("./iiko");
