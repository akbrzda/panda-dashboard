function asString(value) {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

export function pickQueryValue(query, keys) {
  for (const key of keys) {
    const value = asString(query[key]);
    if (value) return value;
  }
  return "";
}

export function parseRangeFilterQuery(query) {
  return {
    org: pickQueryValue(query, ["org", "orgs", "organizationId"]),
    preset: pickQueryValue(query, ["preset"]),
    from: pickQueryValue(query, ["from", "dateFrom", "startDate"]),
    to: pickQueryValue(query, ["to", "dateTo", "endDate"]),
  };
}

export function parseDateFilterQuery(query) {
  return {
    org: pickQueryValue(query, ["org", "orgs", "organizationId"]),
    date: pickQueryValue(query, ["date", "from", "dateFrom"]),
  };
}

function removeLegacyKeys(query) {
  delete query.orgs;
  delete query.organizationId;
  delete query.dateFrom;
  delete query.dateTo;
  delete query.startDate;
  delete query.endDate;
}

export function buildRangeFilterQuery(currentQuery, state) {
  const nextQuery = { ...currentQuery };

  removeLegacyKeys(nextQuery);
  delete nextQuery.date;

  if (state.org) {
    nextQuery.org = state.org;
  } else {
    delete nextQuery.org;
  }

  if (state.preset) {
    nextQuery.preset = state.preset;
  } else {
    delete nextQuery.preset;
  }

  if (state.preset === "custom" && state.from && state.to) {
    nextQuery.from = state.from;
    nextQuery.to = state.to;
  } else {
    delete nextQuery.from;
    delete nextQuery.to;
  }

  if (state.completedOnly === "false") {
    nextQuery.completedOnly = "false";
  } else {
    delete nextQuery.completedOnly;
  }

  return nextQuery;
}

export function buildDateFilterQuery(currentQuery, state) {
  const nextQuery = { ...currentQuery };

  removeLegacyKeys(nextQuery);
  delete nextQuery.preset;
  delete nextQuery.from;
  delete nextQuery.to;

  if (state.org) {
    nextQuery.org = state.org;
  } else {
    delete nextQuery.org;
  }

  if (state.date) {
    nextQuery.date = state.date;
  } else {
    delete nextQuery.date;
  }

  if (state.completedOnly === "false") {
    nextQuery.completedOnly = "false";
  } else {
    delete nextQuery.completedOnly;
  }

  return nextQuery;
}
