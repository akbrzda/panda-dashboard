# Реестр источников и сопоставление отчетов

Дата актуализации: 2026-04-18

## 1. Подтвержденные источники iiko

- iikoCloud OpenAPI (Transport/Biz cloud API): `https://api-ru.iiko.services/api-docs/docs`
- Инструкция по подключению внешнего API iikoDelivery (iiko.Biz): `https://rapid.iiko.ru/userguide/Ispolzovanie_iiko/Kak_podkluchit_vneshniy_API.pdf`
- Логика текущего проекта: frontend-каталог отчетов `apps/web-panel/src/config/reportCatalog.js`, backend модуль отчетов `backend/src/modules/reports/`

Проверенные в OpenAPI группы endpoint-ов, которые используются в проекте:

- `/api/1/organizations`
- `/api/1/deliveries/by_delivery_date_and_status`
- `/api/1/marketing_sources`
- `/api/1/stop_lists`
- `/api/1/employees/couriers`
- `/api/2/menu`

Для Server-части проект использует OLAP/Server-интеграцию через backend-клиенты (`/resto/api/v2/reports/olap` и related flows), что зафиксировано в коде модулей отчетов и дорожной документации.

## 2. Сопоставление списка отчетов с текущими экранами

| Отчет из списка | Тариф из списка | Источник из списка | Подтвержденный источник в проекте | Текущий экран/модуль | Статус |
| --- | --- | --- | --- | --- | --- |
| Сводка | Бесплатно | Transport или Biz | Transport/Biz + агрегаты проекта | `/dashboard` | Частично |
| Сводка за период | 600 ₽ | Transport или Biz | Transport/Biz (iikoCloud deliveries, без fallback) | `/delivery-summary` | Реализован |
| Учётный период | 600 ₽ | Server | Server | Нет прямого экрана | Не реализован |
| Продажи по часам | 400 ₽ | Transport или Biz | Server OLAP SALES | `/hourly-sales` | Реализован |
| Меню | Бесплатно | Transport или Biz | Transport/Biz | `/product-abc`, `/stop-list` | Частично |
| Персонал | Бесплатно | Transport/Biz, Server | Server/Employees | Нет прямого экрана | Не реализован |
| Клиенты | 600 ₽ | Transport/Biz, Server | Transport/Biz + Server OLAP (дата регистрации клиента) + profile fallback | `/clients` | Реализован |
| Группы 0-90-180 дней | 600 ₽ | Transport/Biz, Server | Transport/Biz + project сегментация | `/clients` | Частично |
| Динамика продаж | 400 ₽ | Transport/Biz, Server | Server OLAP SALES | `/revenue` | Реализован |
| Продажи роллов | 400 ₽ | Transport/Biz, Server | Server OLAP SALES | `/top-dishes` | Частично |
| Акции и промокоды | 400 ₽ | Transport/Biz, Server | Server OLAP SALES | `/promotions` | Реализован |
| Маркетинговые источники | 400 ₽ | Transport или Biz | Transport/Biz | `/marketing-sources` | Реализован |
| Ассоциации блюд | В разработке | - | - | Нет экрана | Не реализован |
| Прогноз расхода | 600 ₽ | Transport/Biz, Server | Server + project forecast | `/production-forecast` | Частично |
| Фонд оплаты труда | 600 ₽ | Server | Server | Нет экрана | Не реализован |
| Продукты на сотрудника в час | 600 ₽ | Server | Server | Нет экрана | Не реализован |
| Расход заготовок | 400 ₽ | Server | Server | Нет экрана | Не реализован |
| Расход продуктов | 400 ₽ | Server | Server | `/foodcost` | Частично |
| Залежавшиеся продукты | 400 ₽ | Server | Server | `/foodcost` (косвенно) | Частично |
| Ожидание отправки (заказы на полке) | 400 ₽ | Transport/Biz, Server | Transport/Biz (iikoCloud deliveries, без fallback) | `/delivery-sla` | Частично |
| Приготовление и упаковка | 400 ₽ | Transport, Server | Transport/Biz (iikoCloud deliveries, без fallback) | `/delivery-sla` | Реализован |
| Контроль времени | 600 ₽ | Server | Transport/Biz (iikoCloud deliveries, без fallback) | `/delivery-sla` | Реализован |
| Опоздания доставок | 400 ₽ | Transport/Biz, Server | Transport/Biz (iikoCloud deliveries, без fallback) | `/delivery-delays` | Реализован |
| Контроль опозданий | 600 ₽ | Server | Transport/Biz (iikoCloud deliveries, без fallback) | `/delivery-delays`, `/courier-kpi` | Частично |
| Себестоимость | 400 ₽ | Server | Server | `/foodcost` | Реализован |
| Банкеты и резервы | 400 ₽ | Transport | Transport/Biz (reserve API есть) | Нет экрана | Не реализован |
| Заказы на карте | 600 ₽ | Transport/Biz, Server | Transport/Biz + Geo data | `/courier-map` | Частично |
| Заказы за день | Бесплатно | Transport или Biz | Transport/Biz | `/delivery-summary` | Частично |
| Монитор кухни | 400 ₽ | Transport или Biz | Transport/Biz | Нет экрана | Не реализован |
| Загрузка производств | 400 ₽ | Transport или Biz | Server + forecast logic | `/production-forecast` | Частично |
| Тепловая карта | 400 ₽ | Transport или Biz | Transport/Biz + heatmap endpoint | `/courier-map` | Частично |
| Курьеры | Бесплатно | Transport или Biz | Transport/Biz | `/courier-kpi` | Реализован |
| Курьеры на карте | 600 ₽ | Transport или Biz | Transport/Biz + Geo | `/courier-map` | Реализован |
| Итоги дня курьеров | 600 ₽ | Transport/Biz, Server | Transport/Biz (iikoCloud deliveries, без fallback) | `/courier-kpi` | Частично |
| Индикаторы KPI | 600 ₽ | Transport/Biz, Server, Geo | Transport/Biz + Server + Geo | `/courier-kpi` | Реализован |
| Заказы курьеров | Бесплатно | Transport или Biz | Transport/Biz (iikoCloud deliveries, без fallback) | `/courier-kpi` | Частично |
| Выезды курьеров | 400 ₽ | Transport или Biz | Transport/Biz (iikoCloud deliveries, без fallback) | `/courier-kpi` | Частично |
| Контроль доставок | 600 ₽ | Transport/Biz, Geo | Transport/Biz + Geo | `/courier-kpi`, `/delivery-sla` | Частично |

## 3. Принятые правила для дальнейших доработок

- Источник отчета фиксируется в документации и в `featureReadiness` перед релизом.
- Для новых OLAP-отчетов Server-поля проверяются через `olap/columns` в рамках реализации.
- Для Transport/Biz сценариев, где нужны live-статусы доставки, первичный источник - iikoCloud endpoint-ы с restriction group из OpenAPI.
- Если основной источник отчета недоступен, backend возвращает ошибку и не переключается на fallback-источник.

## 4. Перевод отчетов на метод из каталога (фактически выполнено)

- `Маркетинговые источники` переведен на основной метод `Transport/Biz` (iikoCloud deliveries) без fallback на `Server OLAP`.
- `Сводка доставки`, `SLA`, `KPI курьеров`, `Опоздания`, `Маршруты курьеров` переведены на `Transport/Biz` (iikoCloud deliveries) без fallback на `Server OLAP`.
- Для отчетов `Продажи по часам`, `Динамика продаж`, `Себестоимость` сохранен `Server`-метод как базовый, так как эти метрики в проекте строятся на OLAP/складских полях и не эквивалентны cloud-delivery данным.
- Следующие кандидаты на перевод по той же схеме (где это бизнес-корректно): `Клиенты`, `Прогноз загрузки` (при наличии полноты данных в cloud для требуемых KPI).
