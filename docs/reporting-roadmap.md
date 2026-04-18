# Дорожная карта отчетности (актуальное состояние)

Дата актуализации: 2026-04-18

## 1. Что синхронизировано с кодом

- Delivery Pack drill-down реализован в интерфейсах:
  - `Delivery Summary` -> переходы по статусам и подразделениям;
  - `Delivery Delays` -> drill-down по часу, курьеру и карточке заказа.
- Customer Pack drill-down реализован в интерфейсах:
  - `Marketing Sources` -> выбор источника и переход в `Clients`;
  - `Clients` -> drill-down по сегменту и карточке клиента.
- Status badges унифицированы:
  - единый mapping статусов в `apps/web-panel/src/config/readinessUi.js`;
  - единое отображение в меню (`Sidebar`) и заголовках экранов (`ReportPageHeader`).
- Введены quality gates в CI:
  - `lint`, `build`, `smoke`, `snapshot/component checks`;
  - workflow: `.github/workflows/quality-gates.yml`.
- Добавлены integration-тесты контракта `controller -> service -> response`:
  - `backend/tests/reports.controller.integration.test.js`.

## 2. Текущий статус этапа 61-90 дней

- delivery pack drill-down: выполнено;
- customer pack drill-down: выполнено;
- status badges in menu/screens: выполнено;
- quality gates in CI: выполнено;
- integration tests на контракт: выполнено;
- синхронизация roadmap/docs: выполнено.

## 3. Источники правды

- Матрица зрелости: `docs/feature-readiness-matrix.md`.
- Каталог готовности экранов (runtime): `apps/web-panel/src/config/featureReadiness.js`.
- UI-правила статусов: `apps/web-panel/src/config/readinessUi.js`.
