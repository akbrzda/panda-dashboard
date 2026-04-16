export { apiClient, API_BASE_URL, isAbortError } from "./httpClient";
export { organizationsApi } from "./organizations";
export { stopListsApi } from "./stopLists";
export { revenueApi } from "./revenue";
export { analyticsApi } from "./analytics";

import { organizationsApi } from "./organizations";
import { stopListsApi } from "./stopLists";
import { revenueApi } from "./revenue";
import { analyticsApi } from "./analytics";

export default {
  organizations: organizationsApi,
  stopLists: stopListsApi,
  revenue: revenueApi,
  analytics: analyticsApi,
};
