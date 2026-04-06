<template>
  <div class="table-container">
    <div v-if="isLoading" class="loading">Загрузка данных...</div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="items.length === 0" class="empty-state">
      <p>Нет данных для отображения</p>
    </div>

    <table v-else class="data-table">
      <thead>
        <tr>
          <th>Дата создания</th>
          <th>Наименование</th>
          <th>SKU</th>
          <th>Филиал</th>
          <th>Причина</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in items" :key="index">
          <td class="item-date">{{ formatDate(item) }}</td>
          <td class="product-name">{{ getProductName(item) }}</td>
          <td class="product-sku">{{ item.sku || item.productCode || "—" }}</td>
          <td>{{ item.organizationName || "—" }}</td>
          <td class="reason">{{ item.reason || "—" }}</td>
          <td>
            <span :class="['status-badge', getStatusClass(item)]">
              {{ getStatusText(item) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
});

const formatDate = (item) => {
  // Приоритет: dateAdd -> openedAt -> дефолтное значение
  const dateString = item.dateAdd || item.openedAt;

  if (!dateString) return "—";

  try {
    // Если дата уже в формате "YYYY-MM-DD HH:mm:ss" (от сервера)
    if (typeof dateString === "string" && dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const [datePart, timePart] = dateString.split(" ");
      const [year, month, day] = datePart.split("-");
      const [hours, minutes] = timePart.split(":");
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    // Если это ISO дата или другой формат
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch (e) {
    return dateString;
  }
};

const getProductName = (item) => {
  // Если есть полное название продукта
  if (item.productFullName) return item.productFullName;
  if (item.productName) return item.productName;
  if (item.itemName) return item.itemName;

  // Если нет названия, показываем SKU или ID
  if (item.sku) {
    return `SKU: ${item.sku}`;
  }

  // В крайнем случае показываем ID
  if (item.productId) {
    return `ID: ${item.productId.substring(0, 8)}...`;
  }

  return "Товар без названия";
};

const getStatusClass = (item) => {
  if (item.balance > 0) {
    return "status-low-stock";
  }
  return "status-stopped";
};

const getStatusText = (item) => {
  if (item.balance > 0) {
    return `Остаток: ${item.balance}`;
  }
  return "В стопе";
};
</script>
