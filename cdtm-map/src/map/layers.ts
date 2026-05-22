import { MAP_BACKGROUND_PATH, MAP_PROJECTION_CODE } from "@/map/config";
import { CASES_DATA_URL } from "@/map/types";

export type MapLayerDefinition = {
  id: string;
  label: string;
  kind: "image" | "vector";
  sourcePath: string;
  projectionCode: string;
  visibleByDefault?: boolean;
};

export const BACKGROUND_LAYER_ID = "background";
export const CASES_LAYER_ID = "cases";

export function getBaseLayers(): MapLayerDefinition[] {
  return [
    {
      id: BACKGROUND_LAYER_ID,
      label: "CTM.png",
      kind: "image",
      sourcePath: MAP_BACKGROUND_PATH,
      projectionCode: MAP_PROJECTION_CODE,
      visibleByDefault: true,
    },
    {
      id: CASES_LAYER_ID,
      label: "Contours des cases",
      kind: "vector",
      sourcePath: CASES_DATA_URL,
      projectionCode: MAP_PROJECTION_CODE,
      visibleByDefault: true,
    },
  ];
}
