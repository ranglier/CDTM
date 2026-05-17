export type CaseFilterState = {
  faction?: string;
  region?: string;
  terrain_cat?: string;
  controle_type?: string;
};

export type FilterableCase = {
  properties?: Record<string, unknown>;
};

export function matchesCaseFilters(feature: FilterableCase, filters: CaseFilterState): boolean {
  const properties = feature.properties ?? {};

  return Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    return properties[key] === value;
  });
}
