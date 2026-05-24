export type CaseFilters = {
  region?: string;
  terrainCat?: string;
  terrainType?: string;
  faction?: string;
  peuple?: string;
  controleType?: string;
  cote?: boolean;
};

export function createDefaultFilters(): CaseFilters {
  // TODO: completer selon les besoins de l'interface.
  return {};
}
