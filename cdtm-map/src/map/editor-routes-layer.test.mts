import assert from "node:assert/strict";
import test from "node:test";

import { buildRouteDisplayCoordinates } from "./route-geometry.ts";

const routePoints: Array<[number, number]> = [
  [0, 0],
  [100, -50],
  [200, 0],
  [300, -80],
];

test("les routes courbes gardent le detail editeur par defaut", () => {
  const coordinates = buildRouteDisplayCoordinates(
    routePoints,
    "curved",
  );

  assert.equal(coordinates.length, (routePoints.length - 1) * 12 + 1);
});

test("les routes courbes publiques peuvent reduire le nombre de segments", () => {
  const coordinates = buildRouteDisplayCoordinates(routePoints, "curved", {
    segmentsPerInterval: 4,
  });

  assert.equal(coordinates.length, (routePoints.length - 1) * 4 + 1);
});
