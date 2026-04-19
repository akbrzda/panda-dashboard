import {
  LayoutDashboard,
  BarChart2,
  Clock3,
  ShieldCheck,
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
import { getFeatureReadiness } from "@/config/featureReadiness";

function withReadiness(item) {
  return {
    ...item,
    ...getFeatureReadiness(item.to),
  };
}

export const reportSectionsCatalog = [
  {
    title: "Обзор",
    items: [
      withReadiness({
        to: "/dashboard",
        label: "Дашборд",
        title: "Дашборд",
        desc: "Сводные KPI по сети и быстрые отклонения",
        icon: LayoutDashboard,
        showInDashboard: false,
      }),
    ],
  },
  {
    title: "Операции",
    items: [
      withReadiness({
        to: "/delivery-delays",
        label: "Опоздания и KPI",
        title: "Опоздания и KPI курьеров",
        desc: "Опоздания заказов и эффективность курьерской доставки",
        icon: Clock3,
      }),
      withReadiness({
        to: "/courier-map",
        label: "Карта курьеров",
        title: "Карта курьеров",
        desc: "Пиковые часы и риск опозданий по дням недели",
        icon: Map,
      }),
      withReadiness({
        to: "/stop-list",
        label: "Стоп-лист",
        title: "Стоп-лист",
        desc: "Управление недоступными позициями",
        icon: ClipboardList,
      }),
    ],
  },
  {
    title: "Продажи",
    items: [
      withReadiness({
        to: "/revenue",
        label: "Выручка",
        title: "Отчет по выручке",
        desc: "Детальная аналитика по каналам и периодам",
        icon: BarChart2,
      }),
      withReadiness({
        to: "/hourly-sales",
        label: "Продажи по часам",
        title: "Продажи по часам",
        desc: "Почасовая динамика выручки и заказов",
        icon: Clock3,
      }),
      withReadiness({
        to: "/top-dishes",
        label: "Продажи меню",
        title: "Продажи меню: Топ и ABC",
        desc: "Единый отчет по топу блюд и ABC-группам",
        icon: UtensilsCrossed,
      }),
      withReadiness({
        to: "/orders-sla",
        label: "SLA заказов",
        title: "SLA заказов",
        desc: "Соблюдение нормативов SLA по всем заказам",
        icon: ShieldCheck,
      }),
    ],
  },
  {
    title: "Клиенты и маркетинг",
    items: [
      withReadiness({
        to: "/clients",
        label: "Клиенты",
        title: "Клиенты",
        desc: "Клиентская аналитика по доставкам",
        icon: Users,
      }),
      withReadiness({
        to: "/marketing-sources",
        label: "Источники",
        title: "Маркетинговые источники",
        desc: "Эффективность каналов привлечения",
        icon: Megaphone,
      }),
      withReadiness({
        to: "/promotions",
        label: "Акции и промо",
        title: "Акции и промокоды",
        desc: "Скидки, доли и динамика",
        icon: Tag,
      }),
    ],
  },
  {
    title: "Финансы и планирование",
    items: [
      withReadiness({
        to: "/foodcost",
        label: "Фудкост",
        title: "Фудкост",
        desc: "Себестоимость и риск по категориям",
        icon: Percent,
      }),
      withReadiness({
        to: "/plans",
        label: "Планы",
        title: "Планы",
        desc: "Цели по KPI и контроль выполнения",
        icon: Target,
      }),
      withReadiness({
        to: "/production-forecast",
        label: "Прогноз загрузки",
        title: "Прогноз загрузки",
        desc: "Ожидаемая нагрузка по периодам",
        icon: Store,
      }),
    ],
  },
];

export const dashboardQuickLinksCatalog = reportSectionsCatalog.flatMap((section) =>
  section.items.filter((item) => item.showInDashboard !== false && item.to !== "/dashboard"),
);
