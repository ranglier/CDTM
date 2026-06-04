import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeCasePickingColorValue,
  encodeCasePickingColor,
  resolveCaseIdFromPickingColor,
} from "./case-tiles.ts";
import { getCasePickingTileRequest } from "./case-picking.ts";
import {
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "./config.ts";

test("l'encodage couleur de picking est reversible", () => {
  const color = encodeCasePickingColor(1327);

  assert.deepEqual(color, { r: 47, g: 5, b: 0 });
  assert.equal(decodeCasePickingColorValue({ ...color, alpha: 255 }), 1327);
  assert.equal(decodeCasePickingColorValue({ ...color, alpha: 0 }), 0);
});

test("une couleur de picking retrouve l'id de case associe", () => {
  const idByValue = ["case_0001", "case_0002", "case_0003"];

  assert.equal(
    resolveCaseIdFromPickingColor(
      { ...encodeCasePickingColor(2), alpha: 255 },
      idByValue,
    ),
    "case_0002",
  );
  assert.equal(
    resolveCaseIdFromPickingColor(
      { ...encodeCasePickingColor(4), alpha: 255 },
      idByValue,
    ),
    null,
  );
});

test("la coordonnee carte se transforme en tuile de picking native", () => {
  const request = getCasePickingTileRequest({
    coordinate: [300, -300],
    extent: MAP_EXTENT,
    tileSize: MAP_TILE_SIZE,
    minZoom: MAP_TILE_MIN_ZOOM,
    maxZoom: MAP_TILE_MAX_ZOOM,
    resolutions: [...MAP_TILE_RESOLUTIONS],
  });

  assert.deepEqual(request, {
    z: 4,
    x: 1,
    y: 1,
    pixelX: 44,
    pixelY: 44,
  });
});

test("les coordonnees hors extent ne demandent aucune tuile de picking", () => {
  assert.equal(
    getCasePickingTileRequest({
      coordinate: [-1, -300],
      extent: MAP_EXTENT,
      tileSize: MAP_TILE_SIZE,
      minZoom: MAP_TILE_MIN_ZOOM,
      maxZoom: MAP_TILE_MAX_ZOOM,
      resolutions: [...MAP_TILE_RESOLUTIONS],
    }),
    null,
  );
});
