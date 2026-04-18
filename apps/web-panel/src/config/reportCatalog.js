import {
  LayoutDashboard,
  BarChart2,
  Clock3,
  ShieldCheck,
  Truck,
  Bike,
  Map,
  Megaphone,
  Tag,
  Store,
  ClipboardList,
  UtensilsCrossed,
  Users,
  Percent,
  Target,
} from "lucide-vue-next";

export const reportSectionsCatalog = [
  {
    title: "Обзор",
    items: [
      {
        to: "/dashboard",
        label: "Дашборд",
        title: "Дашборд",
        desc: "Сводные KPI по сети и быстрые отклонения",
        icon: LayoutDashboard,
        showInDashboard: false,
      },
    ],
  },
  {
    title: "Продажи",
    items: [
      {
        to: "/revenue",
        label: "Выручка",
        title: "Отчет по выручке",
        desc: "Детальная аналитика по каналам и периодам",
        icon: BarChart2,
      },
      {
        to: "/hourly-sales",
        label: "Продажи по часам",
        title: "Продажи по часам",
        desc: "Почасовая динамика выручки и заказов",
        icon: Clock3,
      },
      {
        to: "/top-dishes",
        label: "Топ блюд",
        title: "Топ блюд",
        desc: "Рейтинг продаж по позициям меню",
        icon: UtensilsCrossed,
      },
      {
        to: "/promotions",
        label: "Акции и промо",
        title: "Акции и промокоды",
        desc: "Скидки, доли и динамика",
        icon: Tag,
      },
      {
        to: "/marketing-sources",
        label: "Источники",
        title: "Маркетинговые источники",
        desc: "Эффективность каналов привлечения",
        icon: Megaphone,
      },
    ],
  },
  {
    title: "Доставка",
    items: [
      {
        to: "/delivery-summary",
        label: "Сводка доставки",
        title: "Сводка доставки",
        desc: "Заказы, выручка, статусы и каналы",
        icon: Truck,
      },
      {
        to: "/delivery-sla",
        label: "SLA доставки",
        title: "SLA доставки",
        desc: "Соблюдение нормативов по этапам",
        icon: ShieldCheck,
      },
      {
        to: "/delivery-delays",
        label: "Опоздания",
        title: "Опоздания",
        desc: "Обещанное и фактическое время",
        icon: Clock3,
      },
      {
        to: "/courier-kpi",
        label: "KPI курьеров",
        title: "KPI курьеров",
        desc: "Эффективность курьеров и SLA",
        icon: Bike,
      },
      {
        to: "/courier-map",
        label: "Тепловая карта",
        title: "Тепловая карта доставки",
        desc: "Пиковые часы и риск опозданий по дням недели",
        icon: Map,
      },
    ],
  },
  {
    title: "Меню",
    items: [
      {
        to: "/menu-assortment",
        label: "ABC-анализ",
        title: "ABC-анализ меню",
        desc: "Группы A/B/C по вкладу в выручку",
        icon: Store,
      },
      {
        to: "/stop-list",
        label: "Стоп-лист",
        title: "Стоп-лист",
        desc: "Управление стоп-листами ресторанов",
        icon: ClipboardList,
      },
      {
        to: "/foodcost",
        label: "Фудкост",
        title: "Фудкост",
        desc: "Себестоимость и риск по категориям",
        icon: Percent,
      },
    ],
  },
  {
    title: "Клиенты и цели",
    items: [
      {
        to: "/clients",
        label: "Клиенты",
        title: "Клиенты",
        desc: "Клиентская аналитика по доставкам",
        icon: Users,
      },
      {
        to: "/plans",
        label: "Планы",
        title: "Планы",
        desc: "Цели по KPI и контроль выполнения",
        icon: Target,
      },
    ],
  },
];

export const dashboardQuickLinksCatalog = reportSectionsCatalog.flatMap((section) =>
  section.items.filter((item) => item.showInDashboard !== false && item.to !== "/dashboard"),
);
