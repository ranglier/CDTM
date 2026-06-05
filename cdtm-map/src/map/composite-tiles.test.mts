import assert from "node:assert/strict";
import test from "node:test";

import {
  createLegacyMapCompositeTileManifest,
  getExpectedMapCompositeTileCount,
  isMapCompositeTileProfile,
  normalizePublicMapCompositeTileManifest,
} from "./composite-tiles.ts";
import {
  MAP_EXTENT,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_MIN_ZOOM,
  MAP_TILE_RESOLUTIONS,
  MAP_TILE_SIZE,
} from "./config.ts";

test("les profils de tuiles composees sont strictement bornes", () => {
  assert.equal(isMapCompositeTileProfile("mobile"), true);
  assert.equal(isMapCompositeTileProfile("desktop"), true);
  assert.equal(isMapCompositeTileProfile("legacy"), false);
  assert.equal(isMapCompositeTileProfile(null), false);
});

test("le manifeste legacy composite garde le contrat de grille", () => {
  const manifest = createLegacyMapCompositeTileManifest("mobile", "hash");

  assert.equal(manifest.mode, "legacy");
  assert.equal(manifest.profile, "mobile");
  assert.equal(manifest.tileSize, MAP_TILE_SIZE);
  assert.equal(manifest.minZoom, MAP_TILE_MIN_ZOOM);
  assert.equal(manifest.maxZoom, MAP_TILE_MAX_ZOOM);
  assert.deepEqual(manifest.resolutions, [...MAP_TILE_RESOLUTIONS]);
  assert.deepEqual(manifest.extent, MAP_EXTENT);
  assert.equal(manifest.currentStateHash, "hash");
  assert.equal(manifest.tileUrlTemplates, null);
});

test("la normalisation accepte un manifeste composite complet", () => {
  const manifest = normalizePublicMapCompositeTileManifest({
    mode: "composite",
    source: "generated",
    profile: "desktop",
    id: "tile-set",
    tileSize: MAP_TILE_SIZE,
    minZoom: MAP_TILE_MIN_ZOOM,
    maxZoom: MAP_TILE_MAX_ZOOM,
    resolutions: [...MAP_TILE_RESOLUTIONS],
    extent: MAP_EXTENT,
    stateHash: "state",
    currentStateHash: "state",
    stale: false,
    generatedAt: "2026-06-05T10:00:00.000Z",
    tileUrlTemplates: {
      faction: "/tiles/desktop/faction/{z}/{x}/{y}.webp",
      influence: "/tiles/desktop/influence/{z}/{x}/{y}.webp",
      topographic: "/tiles/desktop/topographic/{z}/{x}/{y}.webp",
    },
    picking: {
      tileUrlTemplate: "/tiles/picking/{z}/{x}/{y}.webp",
      idByValue: ["A1"],
    },
  });

  assert.equal(manifest?.mode, "composite");
  assert.equal(manifest?.profile, "desktop");
  assert.equal(manifest?.tileUrlTemplates?.faction.includes("faction"), true);
  assert.equal(manifest?.picking?.idByValue[0], "A1");
});

test("la normalisation refuse un manifeste composite incomplet", () => {
  assert.equal(
    normalizePublicMapCompositeTileManifest({
      mode: "composite",
      source: "generated",
      profile: "mobile",
      id: "tile-set",
      tileSize: MAP_TILE_SIZE,
      minZoom: MAP_TILE_MIN_ZOOM,
      maxZoom: MAP_TILE_MAX_ZOOM,
      resolutions: [...MAP_TILE_RESOLUTIONS],
      extent: MAP_EXTENT,
      stateHash: "state",
      currentStateHash: "state",
      stale: false,
      generatedAt: null,
      tileUrlTemplates: {
        faction: "/tiles/faction/{z}/{x}/{y}.webp",
      },
      picking: null,
    }),
    null,
  );
});

test("le nombre de tuiles composees attendues couvre les trois modes publics", () => {
  assert.equal(getExpectedMapCompositeTileCount(), 855);
});
