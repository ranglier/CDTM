import { readFile } from "node:fs/promises";
import path from "node:path";

import type { StableCaseFeatureCollection, StableCaseProperties } from "@/map/types";
import { isStableCaseFeatureCollection } from "@/map/types";

type GlobalStableCaseState = typeof globalThis & {
  __cdtmStableCaseIndex?: Promise<Map<string, StableCaseProperties>>;
};

function getGlobalStableCaseState(): GlobalStableCaseState {
  return globalThis as GlobalStableCaseState;
}

async function loadStableCaseIndexFromDisk(): Promise<Map<string, StableCaseProperties>> {
  const filePath = path.join(process.cwd(), "public/data/cases.geojson");
  const fileContents = await readFile(filePath, "utf8");
  const parsed = JSON.parse(fileContents) as StableCaseFeatureCollection;

  if (!isStableCaseFeatureCollection(parsed)) {
    throw new Error("public/data/cases.geojson does not match the stable case schema.");
  }

  return new Map(
    parsed.features.map((feature) => [
      feature.properties.id_case,
      {
        ...feature.properties,
        registry_id_case: feature.properties.id_case,
      },
    ]),
  );
}

export async function loadStableCaseIndex(): Promise<Map<string, StableCaseProperties>> {
  const globals = getGlobalStableCaseState();

  if (!globals.__cdtmStableCaseIndex) {
    globals.__cdtmStableCaseIndex = loadStableCaseIndexFromDisk().catch((error) => {
      globals.__cdtmStableCaseIndex = undefined;
      throw error;
    });
  }

  return globals.__cdtmStableCaseIndex;
}
