import assert from "node:assert/strict";
import test from "node:test";

import {
  countCoordinates,
  createInteractionFeatureCollection,
  simplifyRing,
} from "../../scripts/generate-case-interaction-data.mjs";

type SourceCollection = Parameters<typeof createInteractionFeatureCollection>[0];

const sourceCollection: SourceCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id_case: "case_0001",
        region: "Eriador",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0.04],
            [2, -0.03],
            [3, 0.05],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        id_case: "case_0002",
        registry_id_case: "registry_0002",
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [10, 10],
              [11, 10.02],
              [12, 10],
              [12, 12],
              [10, 12],
              [10, 10],
            ],
          ],
        ],
      },
    },
  ],
};

function countCollectionCoordinates(collection: {
  features: Array<{ geometry: { coordinates: unknown } }>;
}): number {
  return countCoordinates(
    collection.features.map((feature) => feature.geometry.coordinates),
  );
}

test("la simplification ferme les anneaux et garde au moins 4 points", () => {
  const ring = simplifyRing(
    [
      [0, 0],
      [1, 0.02],
      [2, -0.02],
      [3, 0],
      [3, 3],
      [0, 3],
      [0, 0],
    ],
    1,
  );

  assert.ok(ring.length >= 4);
  assert.deepEqual(ring[0], ring.at(-1));
});

test("le GeoJSON d'interaction conserve les IDs et le nombre de features", () => {
  const interaction = createInteractionFeatureCollection(sourceCollection, 1);

  assert.equal(interaction.features.length, sourceCollection.features.length);
  assert.deepEqual(
    interaction.features.map((feature) => feature.properties),
    [
      { id_case: "case_0001", registry_id_case: "case_0001" },
      { id_case: "case_0002", registry_id_case: "registry_0002" },
    ],
  );
});

test("la generation est deterministe et reduit les coordonnees", () => {
  const first = createInteractionFeatureCollection(sourceCollection, 1);
  const second = createInteractionFeatureCollection(sourceCollection, 1);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.ok(countCollectionCoordinates(first) < countCollectionCoordinates(sourceCollection));
});
