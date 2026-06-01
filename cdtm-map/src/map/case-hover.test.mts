import assert from "node:assert/strict";
import test from "node:test";

import { buildCaseHoverRows, getCaseHoverTitle } from "./case-hover.ts";

test("le titre de survol des cases est masque en modes faction et influence", () => {
  assert.equal(getCaseHoverTitle("faction"), null);
  assert.equal(getCaseHoverTitle("influence"), null);
  assert.equal(getCaseHoverTitle("topographic"), "Case");
});

test("le controle partiel est explicite au survol", () => {
  const rows = buildCaseHoverRows("influence", {
    id_case: "case_test",
    controleur: "harad",
    controle_type: "partiel",
  });

  assert.deepEqual(rows, [
    { label: "Controleur", value: "harad" },
    { label: "Controle", value: "Controle partiel de Harad" },
  ]);
});

test("les controles occupes, vassaux et contestes sont explicites au survol", () => {
  assert.deepEqual(
    buildCaseHoverRows("influence", {
      id_case: "case_occupee",
      controleur: "mordor",
      controle_type: "occupe",
    }),
    [
      { label: "Controleur", value: "mordor" },
      { label: "Controle", value: "Occupe par Mordor" },
    ],
  );

  assert.deepEqual(
    buildCaseHoverRows("influence", {
      id_case: "case_vassale",
      controleur: "gondor",
      controle_type: "vassalise",
    }),
    [
      { label: "Controleur", value: "gondor" },
      { label: "Controle", value: "Vassal de Gondor" },
    ],
  );

  assert.deepEqual(
    buildCaseHoverRows("faction", {
      id_case: "case_contestee",
      faction: "angmar",
      controleur: "fealnir",
      controle_type: "conteste",
    }),
    [
      { label: "Faction", value: "angmar" },
      { label: "Controle", value: "Conflit entre Angmar et Fealnir" },
    ],
  );
});

test("le type de controle total est masque au survol", () => {
  const rows = buildCaseHoverRows("faction", {
    id_case: "case_test",
    faction: "royaume_des_hommes",
    controle_type: "total",
  });

  assert.deepEqual(rows, [{ label: "Faction", value: "royaume_des_hommes" }]);
});
