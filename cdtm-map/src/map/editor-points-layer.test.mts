import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMapObjectPointShape,
  resolveDefaultLocalityRenderShape,
  resolveLocalityPointShape,
} from "./point-shapes.ts";

test("les points de localite utilisent les formes attendues", () => {
  assert.equal(resolveLocalityPointShape("hameau"), "locality");
  assert.equal(resolveLocalityPointShape("ville_non_fortifiee"), "locality");
  assert.equal(resolveLocalityPointShape("fort"), "fort");
  assert.equal(resolveLocalityPointShape("ville_fortifiee"), "fortified_city");
  assert.equal(resolveLocalityPointShape("cite_fortifiee"), "fortified_city");
});

test("les surcharges de forme de point acceptent seulement les valeurs connues", () => {
  assert.equal(normalizeMapObjectPointShape("auto"), null);
  assert.equal(normalizeMapObjectPointShape(""), null);
  assert.equal(normalizeMapObjectPointShape("diamond"), "diamond");
  assert.equal(normalizeMapObjectPointShape("triangle"), null);
});

test("les formes de rendu par defaut restent lisibles", () => {
  assert.equal(resolveDefaultLocalityRenderShape("hameau"), "circle");
  assert.equal(resolveDefaultLocalityRenderShape("fort"), "square");
  assert.equal(resolveDefaultLocalityRenderShape("ville_fortifiee"), "star");
});
