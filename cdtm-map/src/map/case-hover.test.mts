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
      controleur: "deorl",
      controle_type: "vassalise",
      controle_secondaire_type: "controleur",
      controle_secondaire_id: "gondor",
    }),
    [
      { label: "Controleur", value: "deorl" },
      { label: "Controle", value: "Vassal de Gondor" },
    ],
  );

  assert.deepEqual(
    buildCaseHoverRows("faction", {
      id_case: "case_contestee",
      faction: "royaume_des_hommes",
      controle_type: "conteste",
      controle_secondaire_type: "faction",
      controle_secondaire_id: "mordor",
    }),
    [
      { label: "Faction", value: "royaume_des_hommes" },
      {
        label: "Controle",
        value: "Conflit entre Royaume Des Hommes et Mordor",
      },
    ],
  );
});

test("le controle conteste conserve un repli historique faction plus controleur", () => {
  assert.deepEqual(
    buildCaseHoverRows("faction", {
      id_case: "case_contestee_legacy",
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

test("le mode faction masque la relation de vassalite au survol", () => {
  assert.deepEqual(
    buildCaseHoverRows("faction", {
      id_case: "case_vassale",
      faction: "royaume_des_hommes",
      controleur: "deorl",
      controle_type: "vassalise",
      controle_principal_type: "controleur",
      controle_principal_id: "deorl",
      controle_secondaire_type: "faction",
      controle_secondaire_id: "royaume_des_hommes",
    }),
    [{ label: "Faction", value: "royaume_des_hommes" }],
  );
});

test("le mode faction affiche le controleur quand aucune faction n'est renseignee", () => {
  assert.deepEqual(
    buildCaseHoverRows("faction", {
      id_case: "case_controleur_seul",
      controleur: "deorl",
    }),
    [{ label: "Controleur", value: "deorl" }],
  );
});

test("le survol evite les relations explicites reflexives", () => {
  assert.deepEqual(
    buildCaseHoverRows("influence", {
      id_case: "case_vassale_reflexive",
      controleur: "deorl",
      controle_type: "vassalise",
      controle_principal_type: "controleur",
      controle_principal_id: "deorl",
    }),
    [
      { label: "Controleur", value: "deorl" },
      { label: "Controle", value: "Vassalite" },
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
