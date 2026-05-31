import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCaseSlots,
  countConsumedSlots,
  PEUPLE_MODIFICATEURS_V1,
  validateLocalityUpgradeLink,
  validateSlotConsumption,
} from "./rules.ts";

test("terrain_type vide desactive le calcul", () => {
  const result = calculateCaseSlots({ terrain_type: "" });

  assert.equal(result.available, false);
  assert.equal(result.reason, "calcul indisponible : terrain principal non renseigné");
});

test("prairie sans bonus donne 5 emplacements max", () => {
  const result = calculateCaseSlots({ terrain_type: "prairie" });

  assert.equal(result.available, true);
  assert.equal(result.emplacements_max, 5);
});

test("colline applique un malus technique de -1", () => {
  const result = calculateCaseSlots({
    terrain_type: "prairie",
    attributes: { colline: true },
  });

  assert.equal(result.available, true);
  assert.equal(result.malus_colline, -1);
  assert.equal(result.emplacements_max, 4);
});

test("borne max a 5", () => {
  const result = calculateCaseSlots({
    terrain_type: "prairie",
    bonus_contextuels: [{ slug: "bonus_test", valeur: 3 }],
  });

  assert.equal(result.available, true);
  assert.equal(result.emplacements_bruts, 8);
  assert.equal(result.emplacements_max, 5);
});

test("borne min a 1", () => {
  const result = calculateCaseSlots({
    terrain_type: "desert",
    attributes: { colline: true },
    bonus_contextuels: [{ slug: "malus_test", valeur: -5 }],
  });

  assert.equal(result.available, true);
  assert.equal(result.emplacements_bruts, -5);
  assert.equal(result.emplacements_max, 1);
});

test("terre_desolee + orques donne 5", () => {
  const result = calculateCaseSlots({
    terrain_type: "terre_desolee",
    peuple_slug: "orques",
    peuple_modificateurs: PEUPLE_MODIFICATEURS_V1,
  });

  assert.equal(result.available, true);
  assert.equal(result.emplacements_bruts, 5);
  assert.equal(result.emplacements_max, 5);
});

test("foret + colline + noldor donne 4", () => {
  const result = calculateCaseSlots({
    terrain_type: "foret",
    peuple_slug: "noldor",
    attributes: { colline: true },
    peuple_modificateurs: PEUPLE_MODIFICATEURS_V1,
  });

  assert.equal(result.available, true);
  assert.equal(result.emplacements_base, 3);
  assert.equal(result.malus_colline, -1);
  assert.equal(result.modificateur_peuple, 2);
  assert.equal(result.emplacements_max, 4);
});

test("cote + lac + fluvial + sindar applique le groupe logique une seule fois", () => {
  const result = calculateCaseSlots({
    terrain_type: "prairie",
    peuple_slug: "sindar",
    attributes: { cote: true, lac: true, fluvial: true },
    peuple_modificateurs: PEUPLE_MODIFICATEURS_V1,
  });

  assert.equal(result.available, true);
  assert.equal(result.modificateur_peuple, 1);
  assert.equal(result.modifiers.filter((line) => line.declencheur === "littoral_et_eaux_majeures").length, 1);
});

test("plusieurs bonus contextuels se cumulent", () => {
  const result = calculateCaseSlots({
    terrain_type: "marais",
    bonus_contextuels: [
      { slug: "sanctuaire", valeur: 1 },
      { slug: "ruines", valeur: 2 },
    ],
  });

  assert.equal(result.available, true);
  assert.equal(result.bonus_contextuel, 3);
  assert.equal(result.emplacements_bruts, 5);
});

test("emplacements utilises et restants sont calcules", () => {
  const result = calculateCaseSlots({
    terrain_type: "prairie",
    emplacements_utilises: 3,
  });

  assert.equal(result.available, true);
  assert.equal(result.emplacements_utilises, 3);
  assert.equal(result.emplacements_restants, 2);
  assert.equal(result.depassement, false);
});

test("ville 3 + fort 2 sur 5 est valide", () => {
  const result = calculateCaseSlots({ terrain_type: "prairie" });
  const validation = validateSlotConsumption(result, [
    { consumes_slot: true, emp_requis: 3 },
    { consumes_slot: true, emp_requis: 2 },
  ]);

  assert.equal(validation.valid, true);
  assert.equal(validation.depassement, false);
  assert.equal(countConsumedSlots([{ consumes_slot: true, emp_requis: 3 }, { consumes_slot: true, emp_requis: 2 }]), 5);
});

test("cite 4 + village 1 sur 5 est valide", () => {
  const result = calculateCaseSlots({ terrain_type: "prairie" });
  const validation = validateSlotConsumption(result, [
    { consumes_slot: true, emp_requis: 4 },
    { consumes_slot: true, emp_requis: 1 },
  ]);

  assert.equal(validation.valid, true);
  assert.equal(validation.depassement, false);
});

test("cite 4 + fort 2 sur 5 detecte le depassement", () => {
  const result = calculateCaseSlots({ terrain_type: "prairie" });
  const validation = validateSlotConsumption(result, [
    { consumes_slot: true, emp_requis: 4 },
    { consumes_slot: true, emp_requis: 2 },
  ]);

  assert.equal(validation.valid, false);
  assert.equal(validation.depassement, true);
});

test("forcage admin possible sur depassement", () => {
  const result = calculateCaseSlots({ terrain_type: "prairie" });
  const validation = validateSlotConsumption(
    result,
    [
      { consumes_slot: true, emp_requis: 4 },
      { consumes_slot: true, emp_requis: 2 },
    ],
    { force: true },
  );

  assert.equal(validation.valid, true);
  assert.equal(validation.forced, true);
});

test("chaine d'amelioration valide sur meme case et type attendu", () => {
  const validation = validateLocalityUpgradeLink({
    current_id: "ville_1",
    current_case_id: "case_1",
    dependency_id: "bourg_1",
    expected_previous_type_key: "bourg",
    dependency_type_key: "bourg",
    dependency_case_id: "case_1",
    dependency_status: "published",
  });

  assert.equal(validation.valid, true);
});

test("chaine d'amelioration refuse une dependance sans case", () => {
  const validation = validateLocalityUpgradeLink({
    current_id: "ville_1",
    current_case_id: "case_1",
    dependency_id: "bourg_1",
    expected_previous_type_key: "bourg",
    dependency_type_key: "bourg",
    dependency_case_id: null,
    dependency_status: "published",
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, "Une amelioration doit rester sur la meme case.");
});

test("chaine d'amelioration refuse un mauvais type precedent", () => {
  const validation = validateLocalityUpgradeLink({
    current_id: "ville_1",
    current_case_id: "case_1",
    dependency_id: "hameau_1",
    expected_previous_type_key: "bourg",
    dependency_type_key: "hameau",
    dependency_case_id: "case_1",
    dependency_status: "published",
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, "La localite amelioree n'a pas le type attendu.");
});

test("chaine d'amelioration refuse une dependance archivee", () => {
  const validation = validateLocalityUpgradeLink({
    current_id: "ville_1",
    current_case_id: "case_1",
    dependency_id: "bourg_1",
    expected_previous_type_key: "bourg",
    dependency_type_key: "bourg",
    dependency_case_id: "case_1",
    dependency_status: "archived",
  });

  assert.equal(validation.valid, false);
  assert.equal(validation.reason, "La localite amelioree ne peut pas etre archivee.");
});
