import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import "./assets/styles/main.css";
import { useThemeStore } from "./stores/theme";
import { useFiltersStore } from "./stores/filters";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

const themeStore = useThemeStore(pinia);
themeStore.init();
useFiltersStore(pinia).hydrateFromStorage();

app.use(router);
app.mount("#app");
