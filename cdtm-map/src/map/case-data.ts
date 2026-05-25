import type { PublicCaseProperties } from "@/admin/types";
import type {
  StableCaseFeatureCollection,
  StableCaseProperties,
} from "@/map/types";
import { toStableCaseProperties } from "@/map/types";

export function getRegistryCaseId(stableCase: StableCaseProperties): string {
  return stableCase.registry_id_case ?? stableCase.id_case;
}

export function getStableCasesFromCollection(
  collection: StableCaseFeatureCollection,
): StableCaseProperties[] {
  return collection.features
    .map((feature) => toStableCaseProperties(feature.properties))
    .filter((stableCase): stableCase is StableCaseProperties => stableCase !== null);
}

export function mergeStableCases(
  baseCases: StableCaseProperties[],
  publicCases: PublicCaseProperties[],
): StableCaseProperties[] {
  const publicCasesByRegistryId = new Map(
    publicCases.map((publicCase) => [publicCase.registry_id_case, publicCase]),
  );

  return baseCases.map((stableCase) => {
    const registryId = getRegistryCaseId(stableCase);
    const publicCase = publicCasesByRegistryId.get(registryId);

    if (!publicCase) {
      return stableCase;
    }

    return {
      registry_id_case: registryId,
      id_case: publicCase.id_case,
      region: publicCase.region,
      sous_region: publicCase.sous_region,
      cote: publicCase.cote,
      lac_majeur: publicCase.lac_majeur,
      cours_eau_majeur: publicCase.cours_eau_majeur,
      terrain_cat: publicCase.terrain_cat,
      terrain_type: publicCase.terrain_type,
      relief: publicCase.relief,
      faction: publicCase.faction,
      controleur: publicCase.controleur,
      controle_type: publicCase.controle_type,
    };
  });
}

export function buildCasePropertiesById(
  stableCases: StableCaseProperties[],
): Record<string, StableCaseProperties> {
  return Object.fromEntries(
    stableCases.map((stableCase) => [getRegistryCaseId(stableCase), stableCase]),
  );
}
