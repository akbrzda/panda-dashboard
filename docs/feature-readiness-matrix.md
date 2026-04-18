# Матрица зрелости функций

Дата актуализации: 2026-04-18

## Правила статусов

- ready - функциональность стабильна и покрывает основной сценарий
- beta - функциональность рабочая, но требует доработок
- partial - функциональность реализована частично
- planned - функциональность запланирована

## Источник правды

Frontend-конфиг статусов и владельцев:

- apps/web-panel/src/config/featureReadiness.js

Этот документ нужен для продуктовой и инженерной синхронизации, меню и экранов.

## Каталог экранов

| Экран               | Домен                  | Tier | Статус  | Owner      | Source                 | Last reviewed | Ограничения                         |
| ------------------- | ---------------------- | ---- | ------- | ---------- | ---------------------- | ------------- | ----------------------------------- |
| Dashboard           | Обзор                  | 1    | ready   | product    | iiko-cloud + iiko-olap | 2026-04-18    | Часть KPI без drill-down            |
| Revenue             | Продажи                | 1    | ready   | frontend   | iiko-olap              | 2026-04-18    | Нет встроенного пояснения LFL       |
| Delivery SLA        | Операции               | 1    | ready   | backend    | iiko-cloud-deliveries  | 2026-04-18    | Требуется активный iikoCloud API    |
| Stop List           | Операции               | 1    | ready   | operations | iiko-stop-list         | 2026-04-18    | История статусов частичная          |
| Clients             | Клиенты и маркетинг    | 1    | ready   | analytics  | iiko-cloud-deliveries  | 2026-04-18    | Деградация профилей при лимитах API |
| Marketing Sources   | Клиенты и маркетинг    | 2    | beta    | analytics  | iiko-cloud-deliveries  | 2026-04-18    | Drill-down в клиентов через контекст источника |
| Top Dishes          | Продажи                | 2    | beta    | analytics  | iiko-olap              | 2026-04-18    | Нет LFL на уровне позиции           |
| Delivery Summary    | Операции               | 2    | beta    | operations | iiko-cloud-deliveries  | 2026-04-18    | Drill-down сценарий внедрен, нужен следующий уровень детализации |
| Delivery Delays     | Операции               | 2    | beta    | operations | iiko-cloud-deliveries  | 2026-04-18    | Часть заказов без полного набора временных меток |
| Foodcost            | Финансы и планирование | 2    | beta    | finance    | iiko-olap              | 2026-04-18    | Пороги фудкоста не унифицированы    |
| Courier Map         | Операции               | 3    | partial | operations | iiko-cloud-deliveries  | 2026-04-18    | Неполное покрытие геоданных         |
| Promotions          | Продажи                | 3    | partial | marketing  | iiko-olap              | 2026-04-18    | Нет детализации промо-механик       |
| Production Forecast | Финансы и планирование | 3    | partial | operations | aggregated             | 2026-04-18    | Нет вероятностного коридора         |
| Plans               | Финансы и планирование | 3    | partial | finance    | manual + aggregated    | 2026-04-18    | Неполная связка факт/план           |
| Courier KPI         | Операции               | 2    | beta    | operations | iiko-cloud-deliveries  | 2026-04-18    | Нужны KPI загрузки смен             |
| Hourly Sales        | Продажи                | 2    | beta    | analytics  | iiko-olap              | 2026-04-18    | Нет сравнения час-к-часу            |
| ABC-анализ меню     | Продажи                | 2    | beta    | analytics  | iiko-olap              | 2026-04-18    | Нужен split по подразделениям       |
