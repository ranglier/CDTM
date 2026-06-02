import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCaseSearchTargets,
  buildPublicObjectSearchTargets,
  resolveMapSearchTarget,
} from "./search.ts";

const caseTargets = buildCaseSearchTargets([
  {
    id_case: "case_0001",
    region: "Eriador",
    sous_region: "Comte",
    terrain_cat: "plaine",
    terrain_type: "prairie",
    faction: "royaume_des_hommes",
    controleur: "gondor",
    cote: true,
  },
  {
    id_case: "case_0002",
    region: "Eriador",
    sous_region: "Comte",
    terrain_cat: "plaine",
    terrain_type: "bocage",
    faction: "royaume_des_hommes",
    controleur: "arnor",
    colline: true,
  },
  {
    id_case: "case_0003",
    region: "Mordor",
    terrain_cat: "desert",
    terrain_type: "terre_desolee",
    faction: "mordor",
    controleur: "mordor",
    fluvial: true,
  },
]);

test("la recherche par region selectionne toutes les cases correspondantes", () => {
  const result = resolveMapSearchTarget(caseTargets, "eriador");

  assert.equal(result?.kind, "cases");
  assert.deepEqual(result?.kind === "cases" ? result.ids : [], [
    "case_0001",
    "case_0002",
  ]);
});

test("la recherche par attribut de case selectionne les cases concernees", () => {
  const result = resolveMapSearchTarget(caseTargets, "colline");

  assert.equal(result?.kind, "cases");
  assert.deepEqual(result?.kind === "cases" ? result.ids : [], ["case_0002"]);
});

test("la recherche d'objet reste disponible quand aucune case ne matche", () => {
  const objectTargets = buildPublicObjectSearchTargets({
    localities: [
      {
        id: "locality_1",
        name: "Minas Tirith",
        type_key: "cite",
        type_label: "Cite",
        icon_key: null,
        marker_shape: null,
        marker_fill_color: null,
        marker_stroke_color: null,
        x: 10,
        y: -10,
        id_case_detected: "case_0001",
        description: null,
      },
    ],
    landmarks: [],
    routes: [],
  });
  const result = resolveMapSearchTarget(
    [...caseTargets, ...objectTargets],
    "minas",
  );

  assert.equal(result?.kind, "locality");
  assert.equal(result?.kind === "locality" ? result.id : null, "locality_1");
});
