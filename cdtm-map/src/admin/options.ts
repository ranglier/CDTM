import nomenclatures from "../../data/reference/nomenclatures.json";

const futureBusiness = nomenclatures.future_business;

export const terrainCategories = futureBusiness.terrain_cat;
export const terrainTypes = futureBusiness.terrain_type;
export const terrainTypesByCategory = futureBusiness.terrain_type_by_cat;
export const reliefOptions = futureBusiness.relief;
export const factionOptions = futureBusiness.faction;
export const controlTypeOptions = futureBusiness.controle_type;

export function getTerrainTypesForCategory(category: string | null | undefined): string[] {
  if (!category) {
    return [];
  }

  return terrainTypesByCategory[category as keyof typeof terrainTypesByCategory] ?? [];
}
