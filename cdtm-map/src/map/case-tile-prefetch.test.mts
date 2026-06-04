import assert from "node:assert/strict";
import test from "node:test";

import { getCaseTilePrefetchRequests } from "./case-tile-prefetch.ts";
import type { PublicMapCaseTileManifest } from "./case-tiles.ts";
import {
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "./config.ts";

function createManifest(): PublicMapCaseTileManifest {
  return {
    mode: "raster",
    source: "generated",
    id: "tile-set-test",
    tileSize: MAP_TILE_SIZE,
    minZoom: MAP_TILE_MIN_ZOOM,
    maxZoom: MAP_TILE_MAX_ZOOM,
    resolutions: [...MAP_TILE_RESOLUTIONS],
    extent: MAP_EXTENT,
    stateHash: "hash",
    currentStateHash: "hash",
    stale: false,
    generatedAt: "2026-06-04T00:00:00.000Z",
    tileUrlTemplates: {
      faction: "/tiles/faction/{z}/{x}/{y}.webp",
      influence: "/tiles/influence/{z}/{x}/{y}.webp",
      topographic: "/tiles/topographic/{z}/{x}/{y}.webp",
    },
    picking: null,
  };
}

test("le prechargement ajoute une marge d'une tuile autour de la vue", () => {
  const requests = getCaseTilePrefetchRequests({
    manifest: createManifest(),
    displayMode: "faction",
    extent: [256, -1024, 512, -768],
    resolution: 1,
    margin: 1,
    preloadLevels: 0,
  });

  assert.deepEqual(
    requests.map(({ z, x, y }) => [z, x, y]),
    [
      [4, 0, 2],
      [4, 1, 2],
      [4, 2, 2],
      [4, 0, 3],
      [4, 1, 3],
      [4, 2, 3],
      [4, 0, 4],
      [4, 1, 4],
      [4, 2, 4],
    ],
  );
});

test("le prechargement est limite aux bords de la carte", () => {
  const requests = getCaseTilePrefetchRequests({
    manifest: createManifest(),
    displayMode: "faction",
    extent: [-500, -4500, 4000, 500],
    resolution: 1,
    margin: 3,
    preloadLevels: 0,
  });

  assert.equal(requests.length, 13 * 16);
  assert.ok(requests.every((request) => request.x >= 0 && request.x < 13));
  assert.ok(requests.every((request) => request.y >= 0 && request.y < 16));
});

test("le prechargement reste sur le mode courant et les zooms existants", () => {
  const requests = getCaseTilePrefetchRequests({
    manifest: createManifest(),
    displayMode: "influence",
    extent: [0, -512, 512, 0],
    resolution: 1,
    margin: 0,
    preloadLevels: 99,
  });
  const zooms = Array.from(new Set(requests.map((request) => request.z)));

  assert.deepEqual(zooms, [4, 3, 2, 1, 0]);
  assert.ok(requests.every((request) => request.url.includes("/influence/")));
  assert.ok(requests.every((request) => !request.url.includes("/picking/")));
});

test("le prechargement choisit le zoom le plus proche de la resolution courante", () => {
  const requests = getCaseTilePrefetchRequests({
    manifest: createManifest(),
    displayMode: "topographic",
    extent: [0, -512, 512, 0],
    resolution: 2,
    margin: 0,
    preloadLevels: 1,
  });

  assert.deepEqual(Array.from(new Set(requests.map((request) => request.z))), [
    3,
    2,
  ]);
});
