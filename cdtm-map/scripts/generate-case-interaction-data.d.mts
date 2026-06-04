export const DEFAULT_INTERACTION_TOLERANCE: number;

export type CaseInteractionPoint = [number, number];

export type CaseInteractionGeometry =
  | {
      type: "Polygon";
      coordinates: CaseInteractionPoint[][];
    }
  | {
      type: "MultiPolygon";
      coordinates: CaseInteractionPoint[][][];
    };

export type CaseInteractionFeature = {
  type: "Feature";
  properties: {
    id_case: string;
    registry_id_case: string;
  };
  geometry: CaseInteractionGeometry;
};

export type CaseInteractionFeatureCollection = {
  type: "FeatureCollection";
  features: CaseInteractionFeature[];
};

export function simplifyRing(
  ring: CaseInteractionPoint[],
  tolerance?: number,
): CaseInteractionPoint[];

export function simplifyGeometry(
  geometry: CaseInteractionGeometry,
  tolerance?: number,
): CaseInteractionGeometry;

export function createInteractionFeature(
  feature: {
    type: "Feature";
    properties: { id_case: string; registry_id_case?: string | null };
    geometry: CaseInteractionGeometry;
  },
  tolerance?: number,
): CaseInteractionFeature;

export function createInteractionFeatureCollection(
  collection: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: {
        id_case: string;
        registry_id_case?: string | null;
        [key: string]: unknown;
      };
      geometry: CaseInteractionGeometry;
    }>;
  },
  tolerance?: number,
): CaseInteractionFeatureCollection;

export function countCoordinates(value: unknown): number;
