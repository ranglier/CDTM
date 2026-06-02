import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSPARENT_CONTROL_COLOR,
  generateControlSplitPrimitives,
  generatePatternPrimitives,
  getCasePatternOverlays,
  getControlSplitBandWidth,
  getPatternSpec,
  resolveCaseControlSplitOverlay,
  type MapExtent,
} from "./case-patterns.ts";
import {
  MAP_PATTERN_DOT_RADIUS_MAX,
  MAP_PATTERN_DOT_RADIUS_MIN,
  MAP_PATTERN_LINE_WIDTH_MAX,
  MAP_PATTERN_LINE_WIDTH_MIN,
  MAP_PATTERN_SPACING_MAX,
  MAP_PATTERN_SPACING_MIN,
  createEmptyPublicMapStyles,
  parseNullableMapStyleNumber,
  type MapPatternType,
} from "./types.ts";

const CASE_EXTENT: MapExtent = [100, -180, 172, -96];
const PATTERN_TYPES: MapPatternType[] = [
  "diagonal",
  "diagonal_reverse",
  "crosshatch",
  "horizontal",
  "vertical",
  "dots",
  "grid",
];

function createStyles() {
  const styles = createEmptyPublicMapStyles();

  styles.faction.gondor = {
    target_type: "faction",
    target_id: "gondor",
    fill: "#2255aa",
    stroke: "#111111",
    pattern_type: null,
    pattern_color: null,
    pattern_spacing: null,
    pattern_line_width: null,
    pattern_dot_radius: null,
    secondary_ratio: null,
  };
  styles.faction.mordor = {
    target_type: "faction",
    target_id: "mordor",
    fill: "#aa2222",
    stroke: "#111111",
    pattern_type: null,
    pattern_color: null,
    pattern_spacing: null,
    pattern_line_width: null,
    pattern_dot_radius: null,
    secondary_ratio: null,
  };

  return styles;
}

test("une meme geometrie garde le meme nombre de hachures quel que soit le zoom", () => {
  const zoomMaxCount = generatePatternPrimitives(
    "diagonal",
    CASE_EXTENT,
  ).length;
  const zoomMinCount = generatePatternPrimitives(
    "diagonal",
    CASE_EXTENT,
  ).length;

  assert.equal(zoomMaxCount, zoomMinCount);
  assert.ok(zoomMaxCount > 0);
});

test("toutes les familles de motifs generent des primitives", () => {
  for (const patternType of PATTERN_TYPES) {
    assert.ok(
      generatePatternPrimitives(patternType, CASE_EXTENT).length > 0,
      patternType,
    );
  }
});

test("les variantes espacees gardent un espacement plus large", () => {
  assert.ok(
    getPatternSpec("diagonal_spaced").step > getPatternSpec("diagonal").step,
  );
  assert.ok(
    generatePatternPrimitives("diagonal_spaced", CASE_EXTENT).length <
      generatePatternPrimitives("diagonal", CASE_EXTENT).length,
  );
});

test("les valeurs null gardent les specs par defaut", () => {
  assert.deepEqual(
    getPatternSpec("diagonal", {
      patternSpacing: null,
      patternLineWidth: null,
      patternDotRadius: null,
    }),
    getPatternSpec("diagonal"),
  );
});

test("pattern_spacing modifie le nombre de primitives", () => {
  assert.ok(
    generatePatternPrimitives("diagonal", CASE_EXTENT, {
      patternSpacing: 24,
    }).length < generatePatternPrimitives("diagonal", CASE_EXTENT).length,
  );
});

test("line_width et dot_radius sont propages dans les specs", () => {
  assert.equal(
    getPatternSpec("diagonal", { patternLineWidth: 3.5 }).lineWidth,
    3.5,
  );
  assert.equal(getPatternSpec("dots", { patternDotRadius: 4 }).dotRadius, 4);
});

test("la validation numerique des styles rejette les valeurs hors bornes", () => {
  assert.equal(
    parseNullableMapStyleNumber(
      "",
      MAP_PATTERN_SPACING_MIN,
      MAP_PATTERN_SPACING_MAX,
      "invalide",
    ),
    null,
  );
  assert.equal(
    parseNullableMapStyleNumber(
      "24",
      MAP_PATTERN_SPACING_MIN,
      MAP_PATTERN_SPACING_MAX,
      "invalide",
    ),
    24,
  );
  assert.throws(() =>
    parseNullableMapStyleNumber(
      MAP_PATTERN_SPACING_MIN - 1,
      MAP_PATTERN_SPACING_MIN,
      MAP_PATTERN_SPACING_MAX,
      "invalide",
    ),
  );
  assert.throws(() =>
    parseNullableMapStyleNumber(
      MAP_PATTERN_LINE_WIDTH_MAX + 1,
      MAP_PATTERN_LINE_WIDTH_MIN,
      MAP_PATTERN_LINE_WIDTH_MAX,
      "invalide",
    ),
  );
  assert.throws(() =>
    parseNullableMapStyleNumber(
      MAP_PATTERN_DOT_RADIUS_MIN - 0.1,
      MAP_PATTERN_DOT_RADIUS_MIN,
      MAP_PATTERN_DOT_RADIUS_MAX,
      "invalide",
    ),
  );
});

test("les variantes espacees gardent leurs defauts sans override", () => {
  assert.equal(getPatternSpec("dots_spaced").step, 18);
  assert.equal(getPatternSpec("dots_spaced").dotRadius, 1.15);
});

test("colline declenche un motif seulement en mode topographique", () => {
  const styles = createEmptyPublicMapStyles();

  assert.equal(
    getCasePatternOverlays({
      displayMode: "faction",
      properties: { id_case: "case_test", colline: true },
      styles,
    }).length,
    0,
  );
  assert.equal(
    getCasePatternOverlays({
      displayMode: "topographic",
      properties: { id_case: "case_test", colline: true },
      styles,
    }).length,
    1,
  );
});

test("les types de controle respectent secondary_ratio du referentiel", () => {
  const styles = createStyles();

  styles.controle_type.conteste = {
    target_type: "controle_type",
    target_id: "conteste",
    fill: null,
    stroke: null,
    pattern_type: "vertical_spaced",
    pattern_color: null,
    pattern_spacing: null,
    pattern_line_width: null,
    pattern_dot_radius: null,
    secondary_ratio: 0.25,
  };

  const overlay = resolveCaseControlSplitOverlay(
    "faction",
    {
      id_case: "case_test",
      faction: "gondor",
      controle_type: "conteste",
      controle_secondaire_type: "faction",
      controle_secondaire_id: "mordor",
    },
    styles,
  );

  assert.ok(overlay);
  assert.equal(overlay.secondaryRatio, 0.25);
  assert.equal(overlay.patternType, "vertical_spaced");
  assert.equal(
    getControlSplitBandWidth(overlay),
    getPatternSpec("vertical_spaced").step * 0.25,
  );
});

test("le controle partiel produit des bandes de couleur sur fond vide", () => {
  const overlay = {
    primaryColor: "#2255aa",
    secondaryColor: TRANSPARENT_CONTROL_COLOR,
    secondaryRatio: 0.5,
    patternType: "horizontal_spaced" as const,
    patternSpacing: null,
    patternLineWidth: null,
    patternDotRadius: null,
  };
  const primitives = generateControlSplitPrimitives(overlay, CASE_EXTENT);

  assert.ok(primitives.length > 0);
  assert.equal(
    getControlSplitBandWidth(overlay),
    getPatternSpec("horizontal_spaced").step * 0.5,
  );
});
