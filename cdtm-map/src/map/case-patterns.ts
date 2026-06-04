import {
  MAP_PATTERN_DOT_RADIUS_MAX,
  MAP_PATTERN_DOT_RADIUS_MIN,
  MAP_PATTERN_LINE_WIDTH_MAX,
  MAP_PATTERN_LINE_WIDTH_MIN,
  MAP_PATTERN_SPACING_MAX,
  MAP_PATTERN_SPACING_MIN,
  normalizeHexColor,
  normalizeMapStyleNumber,
  normalizePatternType,
  type MapDisplayMode,
  type MapPatternType,
  type PublicMapStyles,
  type StableCaseProperties,
} from "./types.ts";

export type ResolvedCaseStyle = {
  fill: string | null;
  stroke: string | null;
  pattern_type: MapPatternType | null;
  pattern_color: string | null;
  pattern_spacing: number | null;
  pattern_line_width: number | null;
  pattern_dot_radius: number | null;
  secondary_ratio: number | null;
};

type ControlActorType = "faction" | "controleur";

type ControlActorTarget = {
  targetType: ControlActorType;
  id: string;
};

export type ControlSplitOverlay = {
  primaryColor: string;
  secondaryColor: string;
  secondaryRatio: number;
  patternType: MapPatternType;
  patternSpacing: number | null;
  patternLineWidth: number | null;
  patternDotRadius: number | null;
};

export type CasePatternOverlay =
  | {
      type: "control-split";
      overlay: ControlSplitOverlay;
    }
  | {
      type: "pattern";
      patternType: MapPatternType;
      patternColor: string;
      patternSpacing: number | null;
      patternLineWidth: number | null;
      patternDotRadius: number | null;
    };

type ControlSplitRule = {
  secondaryRatio: number;
  fallbackPatternType: MapPatternType;
};

export type PatternKind =
  | "diagonal"
  | "diagonal_reverse"
  | "crosshatch"
  | "horizontal"
  | "vertical"
  | "dots"
  | "grid";

export type PatternSpec = {
  kind: PatternKind;
  step: number;
  lineWidth: number;
  dotRadius: number;
};

export type PatternSpecOverrides = {
  patternSpacing?: number | null;
  patternLineWidth?: number | null;
  patternDotRadius?: number | null;
};

export type MapPoint = [number, number];
export type MapExtent = [number, number, number, number];

export type PatternPrimitive =
  | {
      type: "line";
      from: MapPoint;
      to: MapPoint;
    }
  | {
      type: "dot";
      center: MapPoint;
    };

export type ControlSplitPrimitive =
  | {
      type: "band";
      points: MapPoint[];
    }
  | {
      type: "dot";
      center: MapPoint;
    };

export const DEFAULT_PATTERN_COLOR = "#000000";
export const HILL_PATTERN_TYPE: MapPatternType = "dots_spaced";
export const HILL_PATTERN_COLOR = "rgba(40, 30, 14, 0.46)";
export const TRANSPARENT_CONTROL_COLOR = "rgba(0, 0, 0, 0)";
export const CONTROL_SPLIT_OVERLAY_ALPHA = 0.88;

const PATTERN_STEP = 12;
const SPACED_PATTERN_STEP = 18;
const PATTERN_LINE_WIDTH = 1.25;

function normalizeSecondaryRatio(value: unknown): number | null {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.min(1, Math.max(0, numericValue));
}

function normalizePatternSpecOverrides(
  value: {
    pattern_spacing?: unknown;
    pattern_line_width?: unknown;
    pattern_dot_radius?: unknown;
  },
): Pick<
  ResolvedCaseStyle,
  "pattern_spacing" | "pattern_line_width" | "pattern_dot_radius"
> {
  return {
    pattern_spacing: normalizeMapStyleNumber(
      value.pattern_spacing,
      MAP_PATTERN_SPACING_MIN,
      MAP_PATTERN_SPACING_MAX,
    ),
    pattern_line_width: normalizeMapStyleNumber(
      value.pattern_line_width,
      MAP_PATTERN_LINE_WIDTH_MIN,
      MAP_PATTERN_LINE_WIDTH_MAX,
    ),
    pattern_dot_radius: normalizeMapStyleNumber(
      value.pattern_dot_radius,
      MAP_PATTERN_DOT_RADIUS_MIN,
      MAP_PATTERN_DOT_RADIUS_MAX,
    ),
  };
}

function getStyleForTarget(
  styles: PublicMapStyles,
  targetType: keyof PublicMapStyles,
  targetId: string | null | undefined,
): ResolvedCaseStyle | null {
  if (!targetId) {
    return null;
  }

  const style = styles[targetType][targetId];

  if (!style) {
    return null;
  }

  return {
    ...normalizePatternSpecOverrides(style),
    fill: normalizeHexColor(style.fill),
    stroke: normalizeHexColor(style.stroke),
    pattern_type: normalizePatternType(style.pattern_type),
    pattern_color: normalizeHexColor(style.pattern_color),
    secondary_ratio: normalizeSecondaryRatio(style.secondary_ratio),
  };
}

function normalizeControlType(value: string | null | undefined): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeControlActor(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeControlActorType(
  value: string | null | undefined,
): ControlActorType | null {
  const normalized = normalizeControlActor(value)?.toLowerCase();

  return normalized === "faction" || normalized === "controleur"
    ? normalized
    : null;
}

function createControlActorTarget(
  targetType: ControlActorType,
  id: string | null | undefined,
): ControlActorTarget | null {
  const normalizedId = normalizeControlActor(id);

  return normalizedId ? { targetType, id: normalizedId } : null;
}

function getExplicitControlActor(
  properties: StableCaseProperties,
  role: "principal" | "secondaire",
): ControlActorTarget | null {
  const targetType = normalizeControlActorType(
    role === "principal"
      ? properties.controle_principal_type
      : properties.controle_secondaire_type,
  );
  const id =
    role === "principal"
      ? properties.controle_principal_id
      : properties.controle_secondaire_id;

  return targetType ? createControlActorTarget(targetType, id) : null;
}

function getCurrentControlActor(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties,
): ControlActorTarget | null {
  const factionActor = createControlActorTarget("faction", properties.faction);
  const controllerActor = createControlActorTarget(
    "controleur",
    properties.controleur,
  );

  return displayMode === "faction"
    ? (factionActor ?? controllerActor)
    : (controllerActor ?? factionActor);
}

function areControlActorsEqual(
  left: ControlActorTarget | null,
  right: ControlActorTarget | null,
): boolean {
  return Boolean(
    left &&
    right &&
    left.targetType === right.targetType &&
    left.id === right.id,
  );
}

function getOtherCurrentControlActor(
  properties: StableCaseProperties,
  primaryActor: ControlActorTarget,
): ControlActorTarget | null {
  const candidates = [
    createControlActorTarget("faction", properties.faction),
    createControlActorTarget("controleur", properties.controleur),
  ];

  return (
    candidates.find(
      (candidate) =>
        candidate && !areControlActorsEqual(candidate, primaryActor),
    ) ?? null
  );
}

function getFallbackPrimaryControlActor(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties,
  controlType: string,
): ControlActorTarget | null {
  if (controlType === "partiel") {
    return getCurrentControlActor(displayMode, properties);
  }

  return (
    createControlActorTarget("faction", properties.faction) ??
    createControlActorTarget("controleur", properties.controleur)
  );
}

function getPrimaryControlSplitActor(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties,
  controlType: string,
): ControlActorTarget | null {
  if (displayMode === "faction" && controlType === "partiel") {
    return getCurrentControlActor(displayMode, properties);
  }

  return (
    getExplicitControlActor(properties, "principal") ??
    getFallbackPrimaryControlActor(displayMode, properties, controlType)
  );
}

function getFallbackSecondaryControlActor(
  properties: StableCaseProperties,
  primaryActor: ControlActorTarget,
  controlType: string,
): ControlActorTarget | null {
  const controllerActor = createControlActorTarget(
    "controleur",
    properties.controleur,
  );

  if (
    (controlType === "vassal" ||
      controlType === "vassalite" ||
      controlType === "vassalise" ||
      controlType === "occupe" ||
      controlType === "occupation") &&
    controllerActor &&
    !areControlActorsEqual(controllerActor, primaryActor)
  ) {
    return controllerActor;
  }

  return getOtherCurrentControlActor(properties, primaryActor);
}

function getControlActorStyle(
  styles: PublicMapStyles,
  preferredTargetType: ControlActorType,
  targetId: string | null | undefined,
): ResolvedCaseStyle | null {
  if (preferredTargetType === "faction") {
    return (
      getStyleForTarget(styles, "faction", targetId) ??
      getStyleForTarget(styles, "controleur", targetId)
    );
  }

  return (
    getStyleForTarget(styles, "controleur", targetId) ??
    getStyleForTarget(styles, "faction", targetId)
  );
}

function isVassalControlType(controlType: string | null): boolean {
  return (
    controlType === "vassal" ||
    controlType === "vassalite" ||
    controlType === "vassalise"
  );
}

function getControlSplitRule(
  controlType: string | null,
): ControlSplitRule | null {
  switch (controlType) {
    case "conteste":
      return {
        secondaryRatio: 0.5,
        fallbackPatternType: "diagonal_spaced",
      };
    case "vassal":
    case "vassalite":
    case "vassalise":
      return {
        secondaryRatio: 0.3,
        fallbackPatternType: "diagonal_reverse_spaced",
      };
    case "occupe":
    case "occupation":
      return {
        secondaryRatio: 0.9,
        fallbackPatternType: "vertical_spaced",
      };
    case "partiel":
      return {
        secondaryRatio: 0.5,
        fallbackPatternType: "horizontal_spaced",
      };
    default:
      return null;
  }
}

export function resolveCaseControlSplitOverlay(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
  styles: PublicMapStyles,
): ControlSplitOverlay | null {
  if (
    !properties ||
    (displayMode !== "faction" && displayMode !== "influence")
  ) {
    return null;
  }

  const controlType = normalizeControlType(properties.controle_type);
  const splitRule = getControlSplitRule(controlType);

  if (
    !controlType ||
    !splitRule ||
    (displayMode === "faction" && isVassalControlType(controlType))
  ) {
    return null;
  }

  const primaryActor = getPrimaryControlSplitActor(
    displayMode,
    properties,
    controlType,
  );

  if (!primaryActor) {
    return null;
  }

  const secondaryActor =
    controlType === "partiel"
      ? null
      : (getExplicitControlActor(properties, "secondaire") ??
        getFallbackSecondaryControlActor(
          properties,
          primaryActor,
          controlType,
        ));
  const primaryStyle = getControlActorStyle(
    styles,
    primaryActor.targetType,
    primaryActor.id,
  );
  const secondaryStyle = secondaryActor
    ? getControlActorStyle(styles, secondaryActor.targetType, secondaryActor.id)
    : null;
  const primaryColor = primaryStyle?.fill;
  const secondaryColor =
    controlType === "partiel"
      ? TRANSPARENT_CONTROL_COLOR
      : secondaryStyle?.fill;

  if (!primaryColor || !secondaryColor || primaryColor === secondaryColor) {
    return null;
  }

  const controlStyle = getStyleForTarget(styles, "controle_type", controlType);

  return {
    primaryColor,
    secondaryColor,
    secondaryRatio: controlStyle?.secondary_ratio ?? splitRule.secondaryRatio,
    patternType: controlStyle?.pattern_type ?? splitRule.fallbackPatternType,
    patternSpacing: controlStyle?.pattern_spacing ?? null,
    patternLineWidth: controlStyle?.pattern_line_width ?? null,
    patternDotRadius: controlStyle?.pattern_dot_radius ?? null,
  };
}

export function resolveCaseBaseStyle(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
  styles: PublicMapStyles,
): ResolvedCaseStyle | null {
  if (!properties) {
    return null;
  }

  switch (displayMode) {
    case "faction":
      return (
        getStyleForTarget(styles, "faction", properties.faction) ??
        getStyleForTarget(styles, "controleur", properties.controleur)
      );
    case "influence":
      return (
        getStyleForTarget(styles, "controleur", properties.controleur) ??
        getStyleForTarget(styles, "faction", properties.faction)
      );
    case "topographic":
      return getStyleForTarget(styles, "terrain_type", properties.terrain_type);
    default:
      return null;
  }
}

export function getCasePatternOverlays({
  displayMode,
  properties,
  styles,
}: {
  displayMode: MapDisplayMode;
  properties: StableCaseProperties | null;
  styles: PublicMapStyles;
}): CasePatternOverlay[] {
  const resolved = resolveCaseBaseStyle(displayMode, properties, styles);
  const controlSplitOverlay = resolveCaseControlSplitOverlay(
    displayMode,
    properties,
    styles,
  );
  const overlays: CasePatternOverlay[] = [];

  if (controlSplitOverlay) {
    overlays.push({
      type: "control-split",
      overlay: controlSplitOverlay,
    });
  }

  if (resolved?.pattern_type) {
    overlays.push({
      type: "pattern",
      patternType: resolved.pattern_type,
      patternColor: resolved.pattern_color ?? DEFAULT_PATTERN_COLOR,
      patternSpacing: resolved.pattern_spacing,
      patternLineWidth: resolved.pattern_line_width,
      patternDotRadius: resolved.pattern_dot_radius,
    });
  }

  if (displayMode === "topographic" && properties?.colline === true) {
    const hillStyle = getStyleForTarget(styles, "case_attribute", "colline");
    overlays.push({
      type: "pattern",
      patternType: hillStyle?.pattern_type ?? HILL_PATTERN_TYPE,
      patternColor: hillStyle?.pattern_color ?? HILL_PATTERN_COLOR,
      patternSpacing: hillStyle?.pattern_spacing ?? null,
      patternLineWidth: hillStyle?.pattern_line_width ?? null,
      patternDotRadius: hillStyle?.pattern_dot_radius ?? null,
    });
  }

  return overlays;
}

export function getPatternSpec(
  patternType: MapPatternType,
  overrides: PatternSpecOverrides = {},
): PatternSpec {
  const spaced = patternType.endsWith("_spaced");
  const step =
    normalizeMapStyleNumber(
      overrides.patternSpacing,
      MAP_PATTERN_SPACING_MIN,
      MAP_PATTERN_SPACING_MAX,
    ) ?? (spaced ? SPACED_PATTERN_STEP : PATTERN_STEP);
  const lineWidth =
    normalizeMapStyleNumber(
      overrides.patternLineWidth,
      MAP_PATTERN_LINE_WIDTH_MIN,
      MAP_PATTERN_LINE_WIDTH_MAX,
    ) ?? (spaced ? 1.15 : PATTERN_LINE_WIDTH);
  const dotRadius =
    normalizeMapStyleNumber(
      overrides.patternDotRadius,
      MAP_PATTERN_DOT_RADIUS_MIN,
      MAP_PATTERN_DOT_RADIUS_MAX,
    ) ?? (spaced ? 1.15 : 1.3);

  switch (patternType) {
    case "diagonal":
    case "diagonal_spaced":
      return { kind: "diagonal", step, lineWidth, dotRadius };
    case "diagonal_reverse":
    case "diagonal_reverse_spaced":
      return { kind: "diagonal_reverse", step, lineWidth, dotRadius };
    case "crosshatch":
    case "crosshatch_spaced":
      return { kind: "crosshatch", step, lineWidth, dotRadius };
    case "horizontal":
    case "horizontal_spaced":
      return { kind: "horizontal", step, lineWidth, dotRadius };
    case "vertical":
    case "vertical_spaced":
      return { kind: "vertical", step, lineWidth, dotRadius };
    case "dots":
    case "dots_spaced":
      return { kind: "dots", step, lineWidth, dotRadius };
    case "grid":
    case "grid_spaced":
      return { kind: "grid", step, lineWidth, dotRadius };
  }
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function getFirstAlignedPosition(
  min: number,
  anchor: number,
  step: number,
): number {
  return min - positiveModulo(min - anchor, step);
}

function getPatternPadding(extent: MapExtent, step: number): number {
  return Math.max(extent[2] - extent[0], extent[3] - extent[1]) + step;
}

function addHorizontalLines(
  primitives: PatternPrimitive[],
  extent: MapExtent,
  step: number,
  padding: number,
): void {
  const [minX, minY, maxX, maxY] = extent;
  const startY = getFirstAlignedPosition(minY - padding, 0, step);

  for (let y = startY; y <= maxY + padding; y += step) {
    primitives.push({
      type: "line",
      from: [minX - padding, y],
      to: [maxX + padding, y],
    });
  }
}

function addVerticalLines(
  primitives: PatternPrimitive[],
  extent: MapExtent,
  step: number,
  padding: number,
): void {
  const [minX, minY, maxX, maxY] = extent;
  const startX = getFirstAlignedPosition(minX - padding, 0, step);

  for (let x = startX; x <= maxX + padding; x += step) {
    primitives.push({
      type: "line",
      from: [x, minY - padding],
      to: [x, maxY + padding],
    });
  }
}

function addDiagonalLines(
  primitives: PatternPrimitive[],
  extent: MapExtent,
  step: number,
  padding: number,
  reverse = false,
): void {
  const [minX, minY, maxX, maxY] = extent;

  if (reverse) {
    const minConstant = minY - maxX - padding;
    const maxConstant = maxY - minX + padding;
    const start = getFirstAlignedPosition(minConstant, 0, step);

    for (let constant = start; constant <= maxConstant; constant += step) {
      primitives.push({
        type: "line",
        from: [minX - padding, minX - padding + constant],
        to: [maxX + padding, maxX + padding + constant],
      });
    }

    return;
  }

  const minConstant = minX + minY - padding;
  const maxConstant = maxX + maxY + padding;
  const start = getFirstAlignedPosition(minConstant, 0, step);

  for (let constant = start; constant <= maxConstant; constant += step) {
    primitives.push({
      type: "line",
      from: [minX - padding, constant - (minX - padding)],
      to: [maxX + padding, constant - (maxX + padding)],
    });
  }
}

function addDots(
  primitives: PatternPrimitive[],
  extent: MapExtent,
  step: number,
  padding: number,
): void {
  const [minX, minY, maxX, maxY] = extent;
  const startX = getFirstAlignedPosition(minX - padding, 0, step);
  const startY = getFirstAlignedPosition(minY - padding, 0, step);

  for (let x = startX; x <= maxX + padding; x += step) {
    for (let y = startY; y <= maxY + padding; y += step) {
      primitives.push({ type: "dot", center: [x, y] });
    }
  }
}

export function generatePatternPrimitives(
  patternType: MapPatternType,
  extent: MapExtent,
  overrides: PatternSpecOverrides = {},
): PatternPrimitive[] {
  const spec = getPatternSpec(patternType, overrides);
  const padding = getPatternPadding(extent, spec.step);
  const primitives: PatternPrimitive[] = [];

  switch (spec.kind) {
    case "diagonal":
      addDiagonalLines(primitives, extent, spec.step, padding);
      break;
    case "diagonal_reverse":
      addDiagonalLines(primitives, extent, spec.step, padding, true);
      break;
    case "crosshatch":
      addDiagonalLines(primitives, extent, spec.step, padding);
      addDiagonalLines(primitives, extent, spec.step, padding, true);
      break;
    case "horizontal":
      addHorizontalLines(primitives, extent, spec.step, padding);
      break;
    case "vertical":
      addVerticalLines(primitives, extent, spec.step, padding);
      break;
    case "dots":
      addDots(primitives, extent, spec.step, padding);
      break;
    case "grid":
      addHorizontalLines(primitives, extent, spec.step, padding);
      addVerticalLines(primitives, extent, spec.step, padding);
      break;
  }

  return primitives;
}

export function getControlSplitBandWidth(overlay: ControlSplitOverlay): number {
  const spec = getPatternSpec(overlay.patternType, overlay);
  const hasEmptySecondaryBands =
    overlay.secondaryColor === TRANSPARENT_CONTROL_COLOR;
  const rawBandWidth = hasEmptySecondaryBands
    ? spec.step * (1 - overlay.secondaryRatio)
    : spec.step * overlay.secondaryRatio;

  return rawBandWidth <= 0
    ? 0
    : Math.min(spec.step, Math.max(0.01, rawBandWidth));
}

export function generateControlSplitPrimitives(
  overlay: ControlSplitOverlay,
  extent: MapExtent,
): ControlSplitPrimitive[] {
  const spec = getPatternSpec(overlay.patternType, overlay);
  const bandWidth = getControlSplitBandWidth(overlay);
  const [minX, minY, maxX, maxY] = extent;
  const padding = Math.max(maxX - minX, maxY - minY) + spec.step * 2;
  const primitives: ControlSplitPrimitive[] = [];

  if (bandWidth <= 0) {
    return primitives;
  }

  function addHorizontalBands() {
    const startY = getFirstAlignedPosition(minY - padding, 0, spec.step);

    for (let y = startY; y <= maxY + padding; y += spec.step) {
      primitives.push({
        type: "band",
        points: [
          [minX - padding, y],
          [maxX + padding, y],
          [maxX + padding, y + bandWidth],
          [minX - padding, y + bandWidth],
        ],
      });
    }
  }

  function addVerticalBands() {
    const startX = getFirstAlignedPosition(minX - padding, 0, spec.step);

    for (let x = startX; x <= maxX + padding; x += spec.step) {
      primitives.push({
        type: "band",
        points: [
          [x, minY - padding],
          [x + bandWidth, minY - padding],
          [x + bandWidth, maxY + padding],
          [x, maxY + padding],
        ],
      });
    }
  }

  function addDiagonalBands(reverse = false) {
    const minConstant = reverse ? minY - maxX - padding : minX + minY - padding;
    const maxConstant = reverse ? maxY - minX + padding : maxX + maxY + padding;
    const start = getFirstAlignedPosition(minConstant, 0, spec.step);

    for (let constant = start; constant <= maxConstant; constant += spec.step) {
      const nextConstant = constant + bandWidth;

      primitives.push(
        reverse
          ? {
              type: "band",
              points: [
                [minX - padding, minX - padding + constant],
                [maxX + padding, maxX + padding + constant],
                [maxX + padding, maxX + padding + nextConstant],
                [minX - padding, minX - padding + nextConstant],
              ],
            }
          : {
              type: "band",
              points: [
                [minX - padding, constant - (minX - padding)],
                [maxX + padding, constant - (maxX + padding)],
                [maxX + padding, nextConstant - (maxX + padding)],
                [minX - padding, nextConstant - (minX - padding)],
              ],
            },
      );
    }
  }

  function addSplitDots() {
    for (const primitive of generatePatternPrimitives(
      overlay.patternType,
      extent,
      overlay,
    )) {
      if (primitive.type === "dot") {
        primitives.push(primitive);
      }
    }
  }

  switch (spec.kind) {
    case "horizontal":
      addHorizontalBands();
      break;
    case "vertical":
      addVerticalBands();
      break;
    case "diagonal_reverse":
      addDiagonalBands(true);
      break;
    case "crosshatch":
      addDiagonalBands(false);
      addDiagonalBands(true);
      break;
    case "grid":
      addHorizontalBands();
      addVerticalBands();
      break;
    case "diagonal":
      addDiagonalBands(false);
      break;
    case "dots":
      addSplitDots();
      break;
  }

  return primitives;
}
