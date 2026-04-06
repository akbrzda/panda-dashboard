<template>
  <div class="revenue-filters">
    <div class="filter-section">
      <label for="organization-select">Город / Филиал</label>
      <select id="organization-select" v-model="localOrganizationId" class="select-field" @change="handleOrganizationChange">
        <option v-if="organizations.length === 0" value="">Загрузка...</option>
        <option v-for="org in organizations" :key="org.id" :value="org.id">
          {{ org.name }}
        </option>
      </select>
    </div>

    <div class="date-picker-section">
      <div class="date-inputs">
        <div class="date-input-group">
          <label for="start-date">Начало периода</label>
          <input id="start-date" type="date" v-model="localStartDate" :max="maxDateStr" class="date-input" />
        </div>

        <div class="date-input-group">
          <label for="end-date">Конец периода</label>
          <input id="end-date" type="date" v-model="localEndDate" :min="localStartDate" :max="maxDateStr" class="date-input" />
        </div>
      </div>
    </div>

    <div class="quick-filters">
      <button @click="setToday" class="quick-btn">Сегодня</button>
      <button @click="setYesterday" class="quick-btn">Вчера</button>
      <button @click="setLastWeek" class="quick-btn">Неделя</button>
      <button @click="setLastMonth" class="quick-btn">Месяц</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  startDate: {
    type: String,
    required: true,
  },
  endDate: {
    type: String,
    required: true,
  },
  organizationId: {
    type: String,
    default: null,
  },
  organizations: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:startDate", "update:endDate", "update:organizationId", "apply"]);

// Локальные копии дат в формате YYYY-MM-DD для input type="date"
const localStartDate = ref(props.startDate || getTodayStr());
const localEndDate = ref(props.endDate || getTodayStr());
const localOrganizationId = ref(props.organizationId);

// Максимальная дата - сегодня в формате YYYY-MM-DD
const maxDateStr = computed(() => getTodayStr());

// Вспомогательная функция для получения даты в формате YYYY-MM-DD
function getTodayStr() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function getDateStr(date) {
  return date.toISOString().split("T")[0];
}
// Можно ли применить фильтр
const canApply = computed(() => {
  return localOrganizationId.value && localStartDate.value && localEndDate.value && localStartDate.value <= localEndDate.value;
});

// Отслеживаем изменения props
watch(
  () => props.organizationId,
  (newVal) => {
    if (newVal) {
      localOrganizationId.value = newVal;
    }
  }
);
// Отслеживаем изменения props
watch(
  () => props.startDate,
  (newVal) => {
    if (newVal) {
      localStartDate.value = newVal;
    }
  }
);

watch(
  () => props.endDate,
  (newVal) => {
    if (newVal) {
      localEndDate.value = newVal;
    }
  }
);

// Автоматическое применение при изменении дат или организации
let debounceTimer = null;
watch([localStartDate, localEndDate, localOrganizationId], () => {
  if (canApply.value) {
    // Debounce для избежания частых запросов при выборе дат
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyFilter();
    }, 300);
  }
});

const applyFilter = () => {
  if (!canApply.value) return;

  emit("update:startDate", localStartDate.value);
  emit("update:endDate", localEndDate.value);
  emit("update:organizationId", localOrganizationId.value);
  emit("apply", {
    startDate: localStartDate.value,
    endDate: localEndDate.value,
    organizationId: localOrganizationId.value,
  });
};

const handleOrganizationChange = () => {
  emit("update:organizationId", localOrganizationId.value);
};

const setToday = () => {
  const today = getTodayStr();
  localStartDate.value = today;
  localEndDate.value = today;
};

const setYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = getDateStr(yesterday);
  localStartDate.value = dateStr;
  localEndDate.value = dateStr;
};
</script>

<style scoped>
.revenue-filters {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-section label {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.select-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  transition: border-color 0.2s;
  cursor: pointer;
}

.select-field:focus {
  outline: none;
  border-color: #4caf50;
}

.date-picker-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.date-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-input-group label {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.date-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  transition: border-color 0.2s;
  font-family: inherit;
}

.date-input:focus {
  outline: none;
  border-color: #4caf50;
}

.date-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
}

.quick-filters {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.quick-btn:hover {
  background-color: #e0e0e0;
  border-color: #999;
}

@media (max-width: 768px) {
  .date-inputs {
    grid-template-columns: 1fr;
  }

  .quick-filters {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
