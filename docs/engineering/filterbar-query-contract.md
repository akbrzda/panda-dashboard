# FilterBar Query Contract & Trust Layer

Дата актуализации: 2026-04-18

## 1. Единый URL-контракт фильтров

### 1.1 Базовые ключи (canonical)

- `org` - идентификатор подразделения
- `preset` - пресет периода (`today`, `yesterday`, `current-week`, `last-week`, `current-month`, `last-month`, `custom`)
- `from` - начало диапазона в формате `YYYY-MM-DD` (только для `preset=custom`)
- `to` - конец диапазона в формате `YYYY-MM-DD` (только для `preset=custom`)

### 1.2 Расширения по страницам

- Dashboard: `date` (режим дневного фильтра)
- Stop List: `status`, `q`
- Clients: `tg`, `statuses`, `profiles`, `profileMode`, `profileLimit`

### 1.3 Backward compatibility (legacy aliases)

При чтении query поддерживаются алиасы:

- `orgs`, `organizationId` -> `org`
- `dateFrom`, `startDate` -> `from`
- `dateTo`, `endDate` -> `to`
- Dashboard: `from`/`dateFrom` -> `date`

После первого синка URL приводится к canonical ключам.

## 1.4 Поведение фильтра подразделений

- До внедрения полноценной мульти-агрегации на backend фильтр работает в режиме выбора одного подразделения.
- Пункт `Все подразделения` временно отключен, чтобы исключить ложное поведение и fallback-логику.

## 2. Trust Layer в ReportPageHeader

Для Tier 1 страниц используется единый `ReportPageHeader` с обязательными полями:

- `updatedAt` - время последнего успешного запроса
- `source` - источник данных из `featureReadiness`
- `coverage` - покрытие выбранных подразделений/среза
- `warnings` - ограничения/деградации из `knownLimitations`

Поля `status`, `tier`, `lastReviewedAt` также берутся из `featureReadiness` и отображаются единообразно на странице.
