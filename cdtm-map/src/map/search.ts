import type {
  EditorMapLandmark,
  EditorMapLocality,
  EditorMapRoute,
} from "../editor/types";
import type {
  PublicMapLandmark,
  PublicMapLocality,
  PublicMapRoute,
} from "./public-objects";
import type { StableCaseProperties } from "./types";

export type MapSearchTarget =
  | {
      kind: "case";
      id: string;
      label: string;
      value: string;
      aliases: string[];
    }
  | {
      kind: "locality";
      id: string;
      label: string;
      value: string;
      aliases: string[];
      x: number;
      y: number;
      id_case_detected: string | null;
    }
  | {
      kind: "landmark";
      id: string;
      label: string;
      value: string;
      aliases: string[];
      x: number;
      y: number;
      id_case_detected: string | null;
    }
  | {
      kind: "route";
      id: string;
      label: string;
      value: string;
      aliases: string[];
      points: Array<[number, number]>;
    };

export type MapSearchResult =
  | MapSearchTarget
  | {
      kind: "cases";
      ids: string[];
      label: string;
      value: string;
    };

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function getObjectKindLabel(kind: MapSearchTarget["kind"]): string {
  switch (kind) {
    case "case":
      return "Case";
    case "locality":
      return "Localite";
    case "landmark":
      return "Landmark";
    case "route":
      return "Route";
  }
}

function createValue(
  kind: MapSearchTarget["kind"],
  label: string,
  id: string,
): string {
  return `${label} - ${getObjectKindLabel(kind)} - ${id}`;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)),
  );
}

function getSearchCaseId(stableCase: StableCaseProperties): string {
  return stableCase.registry_id_case ?? stableCase.id_case;
}

function caseAttributeAliases(stableCase: StableCaseProperties): string[] {
  return [
    stableCase.cote ? "cote" : null,
    stableCase.cote ? "cotier" : null,
    stableCase.lac ? "lac" : null,
    stableCase.lac ? "lacustre" : null,
    stableCase.fluvial ? "fluvial" : null,
    stableCase.fluvial ? "fleuve" : null,
    stableCase.fluvial ? "cours d eau" : null,
    stableCase.colline ? "colline" : null,
    stableCase.colline ? "collines" : null,
  ].filter((value): value is string => value !== null);
}

export function buildCaseSearchTargets(
  stableCases: StableCaseProperties[],
): MapSearchTarget[] {
  return stableCases.map((stableCase) => {
    const registryId = getSearchCaseId(stableCase);
    const label = stableCase.id_case;

    return {
      kind: "case",
      id: registryId,
      label,
      value: createValue("case", label, registryId),
      aliases: uniqueStrings([
        registryId,
        stableCase.id_case,
        label,
        stableCase.region,
        stableCase.sous_region,
        stableCase.terrain_cat,
        stableCase.terrain_type,
        stableCase.peuple,
        stableCase.faction,
        stableCase.controleur,
        stableCase.controle_type,
        ...caseAttributeAliases(stableCase),
      ]),
    };
  });
}

export function buildPublicObjectSearchTargets({
  localities,
  landmarks,
  routes,
}: {
  localities: PublicMapLocality[];
  landmarks: PublicMapLandmark[];
  routes: PublicMapRoute[];
}): MapSearchTarget[] {
  return [
    ...localities.map(
      (locality): MapSearchTarget => ({
        kind: "locality",
        id: locality.id,
        label: locality.name,
        value: createValue("locality", locality.name, locality.id),
        aliases: uniqueStrings([
          locality.id,
          locality.name,
          locality.type_key,
          locality.type_label,
        ]),
        x: locality.x,
        y: locality.y,
        id_case_detected: locality.id_case_detected,
      }),
    ),
    ...landmarks.map(
      (landmark): MapSearchTarget => ({
        kind: "landmark",
        id: landmark.id,
        label: landmark.name,
        value: createValue("landmark", landmark.name, landmark.id),
        aliases: uniqueStrings([
          landmark.id,
          landmark.name,
          landmark.type_key,
          landmark.type_label,
        ]),
        x: landmark.x,
        y: landmark.y,
        id_case_detected: landmark.id_case_detected,
      }),
    ),
    ...routes.map(
      (route): MapSearchTarget => ({
        kind: "route",
        id: route.id,
        label: route.name,
        value: createValue("route", route.name, route.id),
        aliases: uniqueStrings([route.id, route.name, route.route_type]),
        points: route.points,
      }),
    ),
  ];
}

export function buildEditorObjectSearchTargets({
  localities,
  landmarks,
  routes,
}: {
  localities: EditorMapLocality[];
  landmarks: EditorMapLandmark[];
  routes: EditorMapRoute[];
}): MapSearchTarget[] {
  return [
    ...localities.map(
      (locality): MapSearchTarget => ({
        kind: "locality",
        id: locality.id_locality,
        label: locality.name,
        value: createValue("locality", locality.name, locality.id_locality),
        aliases: uniqueStrings([
          locality.id_locality,
          locality.name,
          locality.type_key,
        ]),
        x: locality.x,
        y: locality.y,
        id_case_detected: locality.id_case_detected,
      }),
    ),
    ...landmarks.map(
      (landmark): MapSearchTarget => ({
        kind: "landmark",
        id: landmark.id_landmark,
        label: landmark.name,
        value: createValue("landmark", landmark.name, landmark.id_landmark),
        aliases: uniqueStrings([
          landmark.id_landmark,
          landmark.name,
          landmark.type_key,
        ]),
        x: landmark.x,
        y: landmark.y,
        id_case_detected: landmark.id_case_detected,
      }),
    ),
    ...routes.map(
      (route): MapSearchTarget => ({
        kind: "route",
        id: route.id_route,
        label: route.name,
        value: createValue("route", route.name, route.id_route),
        aliases: uniqueStrings([route.id_route, route.name, route.route_type]),
        points: route.points,
      }),
    ),
  ];
}

export function resolveMapSearchTarget(
  targets: MapSearchTarget[],
  rawQuery: string,
): MapSearchResult | null {
  const query = normalizeSearchText(rawQuery);
  const labelQuery = rawQuery.trim();

  if (!query) {
    return null;
  }

  const exactMatches = targets.filter((target) =>
    [target.value, target.label, ...target.aliases].some(
      (value) => normalizeSearchText(value) === query,
    ),
  );
  const exactResolution = resolveMatches(exactMatches, labelQuery);

  if (exactResolution) {
    return exactResolution;
  }

  const prefixMatches = targets.filter((target) =>
    [target.label, ...target.aliases].some((value) =>
      normalizeSearchText(value).startsWith(query),
    ),
  );
  const prefixResolution = resolveMatches(prefixMatches, labelQuery);

  if (prefixResolution) {
    return prefixResolution;
  }

  const includesMatches = targets.filter((target) =>
    [target.label, ...target.aliases].some((value) =>
      normalizeSearchText(value).includes(query),
    ),
  );

  return resolveMatches(includesMatches, labelQuery);
}

function resolveMatches(
  matches: MapSearchTarget[],
  labelQuery: string,
): MapSearchResult | null {
  const caseMatches = matches.filter(
    (target): target is Extract<MapSearchTarget, { kind: "case" }> =>
      target.kind === "case",
  );

  if (caseMatches.length > 0) {
    const ids = uniqueStrings(caseMatches.map((target) => target.id));

    return {
      kind: "cases",
      ids,
      label:
        ids.length === 1
          ? caseMatches[0].label
          : `${ids.length} cases : ${labelQuery}`,
      value: labelQuery,
    };
  }

  return matches.length === 1 ? matches[0] : null;
}
