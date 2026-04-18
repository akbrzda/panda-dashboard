# Panda Dashboard

Panda Dashboard - аналитическая платформа ресторанной сети в формате монорепозитория.

Проект объединяет веб-интерфейс аналитики, backend-агрегации и вспомогательные приложения. Основная цель - дать бизнесу быстрый и надежный ответ на вопросы по продажам, операциям, клиентам и планированию.

## Основные возможности

- Единая аналитика по продажам, доставке, клиентам и фудкосту
- Drill-down отчеты с фильтрацией по периоду и подразделениям
- Статусы зрелости экранов: Ready, Beta, Partial
- Поддержка адаптивного интерфейса для desktop/tablet/mobile
- Интеграция с iiko OLAP и iiko Cloud API

## Архитектура

Монорепозиторий состоит из трех основных зон:

- apps/web-panel - Vue 3 SPA (Pinia, Vue Router, Tailwind, shadcn-vue)
- backend - Node.js/Express API с модульной архитектурой
- docs - продуктовая и инженерная документация

Схема backend-слоев:

- Routes -> Controller -> Service -> Repository

Схема frontend-слоев:

- View (views/components) -> Store (Pinia) -> API (httpClient/services)

## Технологический стек

- Frontend: Vue 3, Pinia, Vue Router, Tailwind CSS, shadcn-vue, Chart.js
- Backend: Node.js, Express, Axios
- Интеграции: iiko OLAP API, iiko Cloud API

## Структура репозитория

- apps/
  - web-panel/
  - bot/
- backend/
- docs/
- TASKS.md

## Быстрый старт

Требования:

- Node.js 18+
- npm 9+

Установка зависимостей:

```bash
npm install
cd backend && npm install
cd ../apps/web-panel && npm install
```

Запуск backend:

```bash
cd backend
npm run dev
```

Запуск web-panel:

```bash
cd apps/web-panel
npm run dev
```

## Переменные окружения

Корневой .env используется backend-приложением.

Минимально необходимые переменные:

- PORT - порт backend (по умолчанию 3000)
- CORS_ORIGIN - разрешенный origin для CORS
- IIKO_API_LOGIN - логин для iiko Cloud API
- IIKO_API_BASE_URL - базовый URL iiko Cloud API
- IIKO_SERVER_BASE_URL или IIKO_BASE_URL - URL iiko Server/Legacy API
- IIKO_USER - пользователь iiko Server API
- IIKO_PASSWORD - пароль iiko Server API

Опционально:

- IIKO_EXTERNAL_MENU_ID
- IIKO_PRICE_CATEGORY_ID
- IIKO_MENU_LANGUAGE
- IIKO_MENU_VERSION
- IIKO_TIMEOUT
- IIKO_OLAP_MAX_ATTEMPTS
- IIKO_NETWORK_RETRIES
- IIKO_MAX_CONCURRENT_REQUESTS
- VITE_API_BASE_URL (для frontend, если API не доступен через /api)

## Ключевые продуктовые разделы

Tier 1 (критические):

- Dashboard
- Revenue
- Delivery SLA
- Stop List
- Clients

Tier 2 (важные):

- Marketing Sources
- Top Dishes
- Delivery Summary
- Delivery Delays
- Foodcost

Tier 3 (дополнительные):

- Courier Map
- Promotions
- Production Forecast
- Plans

Подробная матрица зрелости: docs/feature-readiness-matrix.md.

## Качество и стандарты

- Архитектурные требования: docs/engineering/architecture.md
- Стандарты кода: docs/engineering/code-standards.md
- Дизайн-система: docs/design_system.md

Перед merge изменений рекомендуется пройти:

- lint
- build
- smoke checks критических экранов
- unit/integration тесты для расчетных модулей

## Текущий фокус развития

- Унификация шаблона аналитических страниц
- Общий FilterBar и сохранение фильтров в URL
- Trust layer (updated at, source, coverage, warnings) на ключевых экранах
- Единый API-контракт ответа для всех отчетов
