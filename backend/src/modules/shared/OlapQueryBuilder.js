class OlapQueryBuilder {
  extractOlapFieldName(value) {
    const source = String(value || "").trim();
    const match = source.match(/^\[([^\]]+)\]$/);
    return match?.[1] || source || null;
  }

  normalizeServerDateValue(value) {
    const source = String(value || "").trim();
    if (!source) {
      return source;
    }

    return source.replace(/\.\d{3}/g, "").replace(/Z$/i, "");
  }

  normalizeServerFilter(filter = {}) {
    const filterType = String(filter.filterType || "").toLowerCase();

    if (filterType === "date_range") {
      return {
        filterType: "DateRange",
        periodType: "CUSTOM",
        from: this.normalizeServerDateValue(filter.dateFrom || filter.from),
        to: this.normalizeServerDateValue(filter.dateTo || filter.to),
        includeLow: filter.includeLeft ?? filter.includeLow ?? true,
        includeHigh: filter.includeRight ?? filter.includeHigh ?? false,
      };
    }

    if (filterType === "range") {
      return {
        filterType: "Range",
        from: filter.valueMin ?? filter.from ?? null,
        to: filter.valueMax ?? filter.to ?? null,
        includeLow: filter.includeLeft ?? filter.includeLow ?? true,
        includeHigh: filter.includeRight ?? filter.includeHigh ?? false,
      };
    }

    if (filterType === "include_values" || filterType === "exclude_values") {
      return {
        filterType: filterType === "include_values" ? "IncludeValues" : "ExcludeValues",
        values: Array.isArray(filter.valueList) ? filter.valueList : Array.isArray(filter.values) ? filter.values : [],
      };
    }

    return filter;
  }

  normalizeFilters(filters) {
    if (!filters) {
      return {};
    }

    if (!Array.isArray(filters)) {
      return filters;
    }

    return filters.reduce((accumulator, filter) => {
      if (filter?.field) {
        accumulator[filter.field] = this.normalizeServerFilter(filter);
      }
      return accumulator;
    }, {});
  }

  buildServerReportBody(body = {}) {
    const calculatedFields = Array.isArray(body.calculatedFields) ? body.calculatedFields : [];
    const dataFields = Array.isArray(body.dataFields) ? body.dataFields : [];
    const aggregateFields = Array.isArray(body.aggregateFields)
      ? body.aggregateFields
      : dataFields
          .map((fieldName) => {
            const calculatedField = calculatedFields.find((item) => item?.name === fieldName);
            return this.extractOlapFieldName(calculatedField?.formula || fieldName);
          })
          .filter(Boolean);

    const filters = this.normalizeFilters(body.filters);
    const storeIds = Array.isArray(body.storeIds) ? body.storeIds.map((value) => String(value || "").trim()).filter(Boolean) : [];

    if (storeIds.length > 0 && !filters["Department.Id"]) {
      filters["Department.Id"] = {
        filterType: "IncludeValues",
        values: storeIds,
      };
    }

    return {
      reportType: body.reportType || body.olapType || "SALES",
      buildSummary: body.buildSummary ?? true,
      groupByRowFields: Array.isArray(body.groupByRowFields) ? body.groupByRowFields : Array.isArray(body.groupFields) ? body.groupFields : [],
      groupByColFields: Array.isArray(body.groupByColFields) ? body.groupByColFields : [],
      aggregateFields,
      filters,
    };
  }

  normalizeServerRows(result, body = {}) {
    if (!Array.isArray(result?.data)) {
      return result;
    }

    const aliasMap = new Map();
    for (const field of body.calculatedFields || []) {
      const actualFieldName = this.extractOlapFieldName(field?.formula || field?.name);
      if (actualFieldName && field?.name) {
        aliasMap.set(actualFieldName, field.name);
      }
    }

    if (aliasMap.size === 0) {
      return result;
    }

    return {
      ...result,
      data: result.data.map((row) => {
        const normalizedRow = { ...row };

        for (const [actualFieldName, alias] of aliasMap.entries()) {
          if (normalizedRow[alias] === undefined && row?.[actualFieldName] !== undefined) {
            normalizedRow[alias] = row[actualFieldName];
          }
        }

        return normalizedRow;
      }),
    };
  }

  parseResultRows(result, cellsMapper) {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.data)) return result.data;
    if (result.result?.rawData) return result.result.rawData;

    if (result.cells) {
      return Object.entries(result.cells).map(([key, values]) => {
        const group = JSON.parse(key);
        return cellsMapper ? cellsMapper(group, Array.isArray(values) ? values : []) : group;
      });
    }

    return [];
  }
}

module.exports = OlapQueryBuilder;
