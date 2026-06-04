import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_PUBLIC_ROUTE_FULL_SEGMENTS,
  MAP_PUBLIC_ROUTE_LOD_SEGMENTS,
  getPublicObjectHitTolerance,
  getPublicPointerMoveThrottleMs,
  getPublicRouteHitTolerance,
  getPublicRouteSegmentsPerInterval,
  resolvePublicObjectDisplayMode,
  shouldUsePublicObjectLod,
  shouldUsePublicRouteLod,
} from "./public-lod.ts";

test("le LOD public s'active au seuil desktop", () => {
  assert.equal(shouldUsePublicObjectLod(3.99, false), false);
  assert.equal(shouldUsePublicObjectLod(4, false), true);
  assert.equal(shouldUsePublicRouteLod(4, false), true);
});

test("le LOD public s'active plus tot sur mobile", () => {
  assert.equal(shouldUsePublicObjectLod(3, false), false);
  assert.equal(shouldUsePublicObjectLod(3, true), true);
  assert.equal(shouldUsePublicRouteLod(3, true), true);
});

test("les icones publiques deviennent des points en LOD", () => {
  assert.equal(resolvePublicObjectDisplayMode("icons", 1, false), "icons");
  assert.equal(resolvePublicObjectDisplayMode("icons", 4, false), "points");
  assert.equal(resolvePublicObjectDisplayMode("points", 4, false), "points");
});

test("les routes publiques utilisent moins de segments en LOD", () => {
  assert.equal(
    getPublicRouteSegmentsPerInterval(1, false),
    MAP_PUBLIC_ROUTE_FULL_SEGMENTS,
  );
  assert.equal(
    getPublicRouteSegmentsPerInterval(4, false),
    MAP_PUBLIC_ROUTE_LOD_SEGMENTS,
  );
});

test("les tolerances de hit detection baissent en LOD", () => {
  assert.equal(getPublicObjectHitTolerance(1, false), 10);
  assert.equal(getPublicObjectHitTolerance(4, false), 8);
  assert.equal(getPublicRouteHitTolerance(1, false), 8);
  assert.equal(getPublicRouteHitTolerance(4, false), 6);
});

test("le pointermove public est cadence seulement en LOD ou mobile", () => {
  assert.equal(getPublicPointerMoveThrottleMs(1, false), 0);
  assert.equal(getPublicPointerMoveThrottleMs(4, false), 80);
  assert.equal(getPublicPointerMoveThrottleMs(1, true), 140);
});
