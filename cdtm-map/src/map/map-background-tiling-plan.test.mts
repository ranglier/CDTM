import assert from "node:assert/strict";
import test from "node:test";

import {
  CASE_TILE_DISPLAY_MODES,
  CASE_TILE_OUTPUT_MODES,
  CASE_TILE_PICKING_MODE,
  getExpectedMapCaseDisplayTileCount,
  getExpectedMapCaseTileCount,
} from "./case-tiles.ts";
import {
  MAP_BACKGROUND_HEIGHT,
  MAP_BACKGROUND_WIDTH,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "./config.ts";

function getTilePlan() {
  return MAP_TILE_RESOLUTIONS.map((resolution, index) => {
    const z = index + MAP_TILE_MIN_ZOOM;
    const width = Math.ceil(MAP_BACKGROUND_WIDTH / resolution);
    const height = Math.ceil(MAP_BACKGROUND_HEIGHT / resolution);
    const columns = Math.ceil(width / MAP_TILE_SIZE);
    const rows = Math.ceil(height / MAP_TILE_SIZE);

    return {
      z,
      resolution,
      width,
      height,
      columns,
      rows,
      tileCount: columns * rows,
    };
  });
}

test("le plan de tuilage couvre z0 a z4 avec z4 en resolution native", () => {
  const plan = getTilePlan();

  assert.deepEqual(
    plan.map((level) => level.z),
    [0, 1, 2, 3, 4],
  );
  assert.equal(MAP_TILE_MIN_ZOOM, 0);
  assert.equal(MAP_TILE_MAX_ZOOM, 4);
  assert.equal(plan.at(-1)?.resolution, 1);
  assert.equal(plan.at(-1)?.width, 3200);
  assert.equal(plan.at(-1)?.height, 4000);
});

test("le nombre attendu de tuiles inclut les tuiles de bord", () => {
  const plan = getTilePlan();
  const tileCount = plan.reduce((sum, level) => sum + level.tileCount, 0);

  assert.deepEqual(
    plan.map((level) => [level.z, level.columns, level.rows]),
    [
      [0, 1, 1],
      [1, 2, 2],
      [2, 4, 4],
      [3, 7, 8],
      [4, 13, 16],
    ],
  );
  assert.equal(tileCount, 285);
});

test("les tuiles raster de cases couvrent les trois modes publics", () => {
  const plan = getTilePlan();
  const tileCount = plan.reduce((sum, level) => sum + level.tileCount, 0);

  assert.deepEqual(CASE_TILE_DISPLAY_MODES, [
    "faction",
    "influence",
    "topographic",
  ]);
  assert.equal(getExpectedMapCaseDisplayTileCount(), tileCount * 3);
  assert.equal(getExpectedMapCaseDisplayTileCount(), 855);
});

test("les tuiles raster de cases incluent le mode technique de picking", () => {
  const plan = getTilePlan();
  const tileCount = plan.reduce((sum, level) => sum + level.tileCount, 0);

  assert.equal(CASE_TILE_PICKING_MODE, "picking");
  assert.deepEqual(CASE_TILE_OUTPUT_MODES, [
    "faction",
    "influence",
    "topographic",
    "picking",
  ]);
  assert.equal(getExpectedMapCaseTileCount(), tileCount * 4);
  assert.equal(getExpectedMapCaseTileCount(), 1140);
});

test("la conversion svg inverse l'axe y local de la carte", () => {
  const mapY = -1840;
  const svgY = -mapY;

  assert.equal(svgY, 1840);
});
