import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style, { type RenderFunction } from "ol/style/Style";

import {
  normalizeHexColor,
  normalizePatternType,
  type MapDisplayMode,
  type MapPatternType,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";

type SelectionState = "default" | "selected" | "active";

type CaseStyleOptions = {
  selectionState: SelectionState;
  displayMode: MapDisplayMode;
  properties: StableCaseProperties | null;
  styles: PublicMapStyles;
};

type ResolvedStyle = {
  fill: string | null;
  stroke: string | null;
  pattern_type: MapPatternType | null;
  pattern_color: string | null;
  secondary_ratio: number | null;
};

const DEFAULT_FILL = "rgba(0, 0, 0, 0)";
const DEFAULT_STROKE = "#000000";
const DEFAULT_PATTERN_COLOR = "#000000";
const DEFAULT_STROKE_WIDTH = 1.2;
const HILL_PATTERN_TYPE: MapPatternType = "dots_spaced";
const HILL_PATTERN_COLOR = "rgba(40, 30, 14, 0.46)";
const PATTERN_STEP = 12;
const SPACED_PATTERN_STEP = 18;
const PATTERN_LINE_WIDTH = 1.25;
const CONTROL_SPLIT_OVERLAY_ALPHA = 0.88;
const TRANSPARENT_CONTROL_COLOR = "rgba(0, 0, 0, 0)";

const styleCache = new Map<string, Style>();
const overlayStyleCache = new Map<string, Style>();

type ControlActorType = "faction" | "controleur";

type ControlActorTarget = {
  targetType: ControlActorType;
  id: string;
};

type ControlSplitOverlay = {
  primaryColor: string;
  secondaryColor: string;
  secondaryRatio: number;
  patternType: MapPatternType;
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
    };

type ControlSplitRule = {
  secondaryRatio: number;
  fallbackPatternType: MapPatternType;
};

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

function getStyleForTarget(
  styles: PublicMapStyles,
  targetType: keyof PublicMapStyles,
  targetId: string | null | undefined,
): ResolvedStyle | null {
  if (!targetId) {
    return null;
  }

  const style = styles[targetType][targetId];

  if (!style) {
    return null;
  }

  return {
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
  const normalized = value?.trim().toLowerCase();

  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeControlActorType(
  value: string | null | undefined,
): ControlActorType | null {
  const normalized = normalizeControlActor(value);

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
): ResolvedStyle | null {
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

function resolveControlSplitOverlay(
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

  if (!controlType || !splitRule) {
    return null;
  }

  const primaryActor =
    getExplicitControlActor(properties, "principal") ??
    getFallbackPrimaryControlActor(displayMode, properties, controlType);

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
  };
}

function resolveBaseStyle(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
  styles: PublicMapStyles,
): ResolvedStyle | null {
  if (!properties) {
    return null;
  }

  switch (displayMode) {
    case "faction":
      return getStyleForTarget(styles, "faction", properties.faction);
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

function buildBaseFill(
  _displayMode: MapDisplayMode,
  style: ResolvedStyle | null,
): string {
  if (!style) {
    return DEFAULT_FILL;
  }

  return style.fill ?? DEFAULT_FILL;
}

type PatternKind =
  | "diagonal"
  | "diagonal_reverse"
  | "crosshatch"
  | "horizontal"
  | "vertical"
  | "dots"
  | "grid";

type PatternSpec = {
  kind: PatternKind;
  step: number;
  lineWidth: number;
  dotRadius: number;
};

type MapExtent = [number, number, number, number];
type Coordinate2D = [number, number];
type CoordinatePair = {
  map: Coordinate2D;
  pixel: Coordinate2D;
};
type AffineTransform = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

function getPatternSpec(patternType: MapPatternType): PatternSpec {
  const spaced = patternType.endsWith("_spaced");
  const step = spaced ? SPACED_PATTERN_STEP : PATTERN_STEP;
  const lineWidth = spaced ? 1.15 : PATTERN_LINE_WIDTH;
  const dotRadius = spaced ? 1.15 : 1.3;

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

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function appendRingPath(
  context: CanvasRenderingContext2D,
  ring: Array<[number, number]>,
) {
  if (ring.length === 0) {
    return;
  }

  context.moveTo(ring[0][0], ring[0][1]);

  for (let index = 1; index < ring.length; index += 1) {
    context.lineTo(ring[index][0], ring[index][1]);
  }

  context.closePath();
}

function appendGeometryPath(
  context: CanvasRenderingContext2D,
  coordinates: unknown,
) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (coordinates.every(isCoordinate)) {
    appendRingPath(context, coordinates);
    return;
  }

  for (const item of coordinates) {
    appendGeometryPath(context, item);
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

function collectCoordinatePairs(
  mapCoordinates: unknown,
  pixelCoordinates: unknown,
  pairs: CoordinatePair[],
): void {
  if (isCoordinate(mapCoordinates) && isCoordinate(pixelCoordinates)) {
    pairs.push({
      map: [mapCoordinates[0], mapCoordinates[1]],
      pixel: [pixelCoordinates[0], pixelCoordinates[1]],
    });
    return;
  }

  if (!Array.isArray(mapCoordinates) || !Array.isArray(pixelCoordinates)) {
    return;
  }

  const length = Math.min(mapCoordinates.length, pixelCoordinates.length);

  for (let index = 0; index < length; index += 1) {
    collectCoordinatePairs(
      mapCoordinates[index],
      pixelCoordinates[index],
      pairs,
    );
  }
}

function solveAffineTransform(
  first: CoordinatePair,
  second: CoordinatePair,
  third: CoordinatePair,
): AffineTransform | null {
  const [x0, y0] = first.map;
  const [x1, y1] = second.map;
  const [x2, y2] = third.map;
  const [px0, py0] = first.pixel;
  const [px1, py1] = second.pixel;
  const [px2, py2] = third.pixel;
  const determinant = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);

  if (Math.abs(determinant) < 0.000001) {
    return null;
  }

  return {
    a: (px0 * (y1 - y2) + px1 * (y2 - y0) + px2 * (y0 - y1)) / determinant,
    b: (x0 * (px1 - px2) + x1 * (px2 - px0) + x2 * (px0 - px1)) / determinant,
    c:
      (x0 * (y2 * px1 - y1 * px2) +
        x1 * (y0 * px2 - y2 * px0) +
        x2 * (y1 * px0 - y0 * px1)) /
      determinant,
    d: (py0 * (y1 - y2) + py1 * (y2 - y0) + py2 * (y0 - y1)) / determinant,
    e: (x0 * (py1 - py2) + x1 * (py2 - py0) + x2 * (py0 - py1)) / determinant,
    f:
      (x0 * (y2 * py1 - y1 * py2) +
        x1 * (y0 * py2 - y2 * py0) +
        x2 * (y1 * py0 - y0 * py1)) /
      determinant,
  };
}

function createMapToPixelTransform(
  mapCoordinates: unknown,
  pixelCoordinates: unknown,
): { transform: AffineTransform; extent: MapExtent } | null {
  const pairs: CoordinatePair[] = [];

  collectCoordinatePairs(mapCoordinates, pixelCoordinates, pairs);

  if (pairs.length < 3) {
    return null;
  }

  let transform: AffineTransform | null = null;

  for (let secondIndex = 1; secondIndex < pairs.length - 1; secondIndex += 1) {
    for (
      let thirdIndex = secondIndex + 1;
      thirdIndex < pairs.length;
      thirdIndex += 1
    ) {
      transform = solveAffineTransform(
        pairs[0],
        pairs[secondIndex],
        pairs[thirdIndex],
      );

      if (transform) {
        break;
      }
    }

    if (transform) {
      break;
    }
  }

  if (!transform) {
    return null;
  }

  const xs = pairs.map((pair) => pair.map[0]);
  const ys = pairs.map((pair) => pair.map[1]);

  return {
    transform,
    extent: [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    ],
  };
}

function transformMapPoint(
  transform: AffineTransform,
  point: Coordinate2D,
): Coordinate2D {
  const [x, y] = point;

  return [
    transform.a * x + transform.b * y + transform.c,
    transform.d * x + transform.e * y + transform.f,
  ];
}

function getAveragePixelScale(transform: AffineTransform): number {
  const horizontalScale = Math.hypot(transform.a, transform.d);
  const verticalScale = Math.hypot(transform.b, transform.e);
  const scale = (horizontalScale + verticalScale) / 2;

  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function moveToMapPoint(
  context: CanvasRenderingContext2D,
  transform: AffineTransform,
  point: Coordinate2D,
): void {
  const [x, y] = transformMapPoint(transform, point);

  context.moveTo(x, y);
}

function lineToMapPoint(
  context: CanvasRenderingContext2D,
  transform: AffineTransform,
  point: Coordinate2D,
): void {
  const [x, y] = transformMapPoint(transform, point);

  context.lineTo(x, y);
}

function addMapPolygonPath(
  context: CanvasRenderingContext2D,
  transform: AffineTransform,
  points: Coordinate2D[],
): void {
  if (points.length === 0) {
    return;
  }

  moveToMapPoint(context, transform, points[0]);

  for (let index = 1; index < points.length; index += 1) {
    lineToMapPoint(context, transform, points[index]);
  }

  context.closePath();
}

function drawWorldHorizontalLines(
  context: CanvasRenderingContext2D,
  extent: MapExtent,
  transform: AffineTransform,
  step: number,
  padding: number,
): void {
  const [minX, minY, maxX, maxY] = extent;
  const startY = getFirstAlignedPosition(minY - padding, 0, step);

  for (let y = startY; y <= maxY + padding; y += step) {
    moveToMapPoint(context, transform, [minX - padding, y]);
    lineToMapPoint(context, transform, [maxX + padding, y]);
  }
}

function drawWorldVerticalLines(
  context: CanvasRenderingContext2D,
  extent: MapExtent,
  transform: AffineTransform,
  step: number,
  padding: number,
): void {
  const [minX, minY, maxX, maxY] = extent;
  const startX = getFirstAlignedPosition(minX - padding, 0, step);

  for (let x = startX; x <= maxX + padding; x += step) {
    moveToMapPoint(context, transform, [x, minY - padding]);
    lineToMapPoint(context, transform, [x, maxY + padding]);
  }
}

function drawWorldDiagonalLines(
  context: CanvasRenderingContext2D,
  extent: MapExtent,
  transform: AffineTransform,
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
      moveToMapPoint(context, transform, [
        minX - padding,
        minX - padding + constant,
      ]);
      lineToMapPoint(context, transform, [
        maxX + padding,
        maxX + padding + constant,
      ]);
    }

    return;
  }

  const minConstant = minX + minY - padding;
  const maxConstant = maxX + maxY + padding;
  const start = getFirstAlignedPosition(minConstant, 0, step);

  for (let constant = start; constant <= maxConstant; constant += step) {
    moveToMapPoint(context, transform, [
      minX - padding,
      constant - (minX - padding),
    ]);
    lineToMapPoint(context, transform, [
      maxX + padding,
      constant - (maxX + padding),
    ]);
  }
}

function drawWorldDots(
  context: CanvasRenderingContext2D,
  extent: MapExtent,
  transform: AffineTransform,
  step: number,
  radius: number,
  padding: number,
): void {
  const [minX, minY, maxX, maxY] = extent;
  const startX = getFirstAlignedPosition(minX - padding, 0, step);
  const startY = getFirstAlignedPosition(minY - padding, 0, step);

  for (let x = startX; x <= maxX + padding; x += step) {
    for (let y = startY; y <= maxY + padding; y += step) {
      const [pixelX, pixelY] = transformMapPoint(transform, [x, y]);

      context.beginPath();
      context.arc(pixelX, pixelY, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawWorldPattern(
  context: CanvasRenderingContext2D,
  extent: MapExtent,
  transform: AffineTransform,
  patternType: MapPatternType,
  patternColor: string,
): void {
  const spec = getPatternSpec(patternType);
  const scale = getAveragePixelScale(transform);
  const padding =
    Math.max(extent[2] - extent[0], extent[3] - extent[1]) + spec.step;

  context.strokeStyle = patternColor;
  context.fillStyle = patternColor;
  context.lineWidth = Math.max(0.45, spec.lineWidth * scale);
  context.lineCap = "round";

  if (spec.kind === "dots") {
    drawWorldDots(
      context,
      extent,
      transform,
      spec.step,
      Math.max(0.45, spec.dotRadius * scale),
      padding,
    );
    return;
  }

  context.beginPath();

  switch (spec.kind) {
    case "diagonal":
      drawWorldDiagonalLines(context, extent, transform, spec.step, padding);
      break;
    case "diagonal_reverse":
      drawWorldDiagonalLines(
        context,
        extent,
        transform,
        spec.step,
        padding,
        true,
      );
      break;
    case "crosshatch":
      drawWorldDiagonalLines(context, extent, transform, spec.step, padding);
      drawWorldDiagonalLines(
        context,
        extent,
        transform,
        spec.step,
        padding,
        true,
      );
      break;
    case "horizontal":
      drawWorldHorizontalLines(context, extent, transform, spec.step, padding);
      break;
    case "vertical":
      drawWorldVerticalLines(context, extent, transform, spec.step, padding);
      break;
    case "grid":
      drawWorldHorizontalLines(context, extent, transform, spec.step, padding);
      drawWorldVerticalLines(context, extent, transform, spec.step, padding);
      break;
  }

  context.stroke();
}

function fillMapBand(
  context: CanvasRenderingContext2D,
  transform: AffineTransform,
  points: Coordinate2D[],
): void {
  context.beginPath();
  addMapPolygonPath(context, transform, points);
  context.fill();
}

function drawWorldControlSplitBands(
  context: CanvasRenderingContext2D,
  extent: MapExtent,
  transform: AffineTransform,
  overlay: ControlSplitOverlay,
): void {
  const spec = getPatternSpec(overlay.patternType);
  const step = spec.step;
  const hasEmptySecondaryBands =
    overlay.secondaryColor === TRANSPARENT_CONTROL_COLOR;
  const rawBandWidth = hasEmptySecondaryBands
    ? step * (1 - overlay.secondaryRatio)
    : step * overlay.secondaryRatio;
  const bandWidth =
    rawBandWidth <= 0 ? 0 : Math.min(step, Math.max(0.01, rawBandWidth));
  const [minX, minY, maxX, maxY] = extent;
  const padding = Math.max(maxX - minX, maxY - minY) + step * 2;

  if (!hasEmptySecondaryBands) {
    context.fillStyle = overlay.primaryColor;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }

  if (bandWidth <= 0) {
    return;
  }

  context.fillStyle = hasEmptySecondaryBands
    ? overlay.primaryColor
    : overlay.secondaryColor;

  function fillHorizontalBands() {
    const startY = getFirstAlignedPosition(minY - padding, 0, step);

    for (let y = startY; y <= maxY + padding; y += step) {
      fillMapBand(context, transform, [
        [minX - padding, y],
        [maxX + padding, y],
        [maxX + padding, y + bandWidth],
        [minX - padding, y + bandWidth],
      ]);
    }
  }

  function fillVerticalBands() {
    const startX = getFirstAlignedPosition(minX - padding, 0, step);

    for (let x = startX; x <= maxX + padding; x += step) {
      fillMapBand(context, transform, [
        [x, minY - padding],
        [x + bandWidth, minY - padding],
        [x + bandWidth, maxY + padding],
        [x, maxY + padding],
      ]);
    }
  }

  function fillDiagonalBands(reverse = false) {
    const minConstant = reverse ? minY - maxX - padding : minX + minY - padding;
    const maxConstant = reverse ? maxY - minX + padding : maxX + maxY + padding;
    const start = getFirstAlignedPosition(minConstant, 0, step);

    for (let constant = start; constant <= maxConstant; constant += step) {
      const nextConstant = constant + bandWidth;

      if (reverse) {
        fillMapBand(context, transform, [
          [minX - padding, minX - padding + constant],
          [maxX + padding, maxX + padding + constant],
          [maxX + padding, maxX + padding + nextConstant],
          [minX - padding, minX - padding + nextConstant],
        ]);
        continue;
      }

      fillMapBand(context, transform, [
        [minX - padding, constant - (minX - padding)],
        [maxX + padding, constant - (maxX + padding)],
        [maxX + padding, nextConstant - (maxX + padding)],
        [minX - padding, nextConstant - (minX - padding)],
      ]);
    }
  }

  function fillDots() {
    const scale = getAveragePixelScale(transform);
    const radius = Math.max(
      0.45,
      Math.min(step * 0.35, bandWidth * 0.5) * scale,
    );

    drawWorldDots(context, extent, transform, step, radius, padding);
  }

  switch (spec.kind) {
    case "horizontal":
      fillHorizontalBands();
      break;
    case "vertical":
      fillVerticalBands();
      break;
    case "diagonal_reverse":
      fillDiagonalBands(true);
      break;
    case "crosshatch":
      fillDiagonalBands(false);
      fillDiagonalBands(true);
      break;
    case "grid":
      fillHorizontalBands();
      fillVerticalBands();
      break;
    case "diagonal":
      fillDiagonalBands(false);
      break;
    case "dots":
      fillDots();
      break;
  }
}

function renderCasePatternOverlay(
  context: CanvasRenderingContext2D,
  pixelCoordinates: unknown,
  mapCoordinates: unknown,
  overlay: CasePatternOverlay,
): void {
  const transformContext = createMapToPixelTransform(
    mapCoordinates,
    pixelCoordinates,
  );

  if (!transformContext) {
    return;
  }

  context.save();
  context.beginPath();
  appendGeometryPath(context, pixelCoordinates);
  context.clip("evenodd");

  if (overlay.type === "control-split") {
    context.globalAlpha = CONTROL_SPLIT_OVERLAY_ALPHA;
    drawWorldControlSplitBands(
      context,
      transformContext.extent,
      transformContext.transform,
      overlay.overlay,
    );
  } else {
    drawWorldPattern(
      context,
      transformContext.extent,
      transformContext.transform,
      overlay.patternType,
      overlay.patternColor,
    );
  }

  context.restore();
}

function createCasePatternRenderer(
  overlay: CasePatternOverlay,
): RenderFunction {
  return (pixelCoordinates, state) => {
    const mapCoordinates = state.geometry.getCoordinates();

    if (!mapCoordinates) {
      return;
    }

    renderCasePatternOverlay(
      state.context,
      pixelCoordinates,
      mapCoordinates,
      overlay,
    );
  };
}

function getOverlayStyle(
  overlay: CasePatternOverlay,
  zIndex: number,
  index: number,
): Style {
  const cacheKey =
    overlay.type === "control-split"
      ? [
          "control",
          overlay.overlay.primaryColor,
          overlay.overlay.secondaryColor,
          overlay.overlay.secondaryRatio,
          overlay.overlay.patternType,
          zIndex,
          index,
        ].join("|")
      : [
          "pattern",
          overlay.patternType,
          overlay.patternColor,
          zIndex,
          index,
        ].join("|");
  const cached = overlayStyleCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const style = new Style({
    renderer: createCasePatternRenderer(overlay),
    zIndex: zIndex + 0.1 + index * 0.01,
  });

  overlayStyleCache.set(cacheKey, style);
  return style;
}

function buildCacheKey(
  displayMode: MapDisplayMode,
  selectionState: SelectionState,
  style: ResolvedStyle | null,
  hasControlSplitOverlay: boolean,
  strokeColor: string,
  strokeWidth: number,
  zIndex: number,
) {
  return [
    displayMode,
    selectionState,
    style?.fill ?? "none",
    style?.stroke ?? DEFAULT_STROKE,
    style?.pattern_type ?? "none",
    style?.pattern_color ?? "none",
    hasControlSplitOverlay ? "control-split" : "normal",
    strokeColor,
    strokeWidth,
    zIndex,
  ].join("|");
}

export function getCaseStyle({
  selectionState,
  displayMode,
  properties,
  styles,
}: CaseStyleOptions): Style | Style[] {
  const resolved = resolveBaseStyle(displayMode, properties, styles);
  const controlSplitOverlay = resolveControlSplitOverlay(
    displayMode,
    properties,
    styles,
  );
  const isUnstyled = resolved === null;
  const baseStrokeColor = resolved?.stroke ?? DEFAULT_STROKE;

  const strokeColor =
    selectionState === "active"
      ? isUnstyled
        ? "rgba(255, 228, 145, 1)"
        : "rgba(220, 193, 130, 0.98)"
      : selectionState === "selected"
        ? isUnstyled
          ? "rgba(240, 210, 140, 0.94)"
          : "rgba(174, 150, 98, 0.92)"
        : baseStrokeColor;

  const strokeWidth =
    selectionState === "active"
      ? isUnstyled
        ? 3
        : 2.2
      : selectionState === "selected"
        ? isUnstyled
          ? 2.2
          : 1.9
        : DEFAULT_STROKE_WIDTH;

  const fillColorWithSelection: string =
    selectionState === "active" && isUnstyled && !controlSplitOverlay
      ? "rgba(220, 193, 130, 0.24)"
      : selectionState === "selected" && isUnstyled && !controlSplitOverlay
        ? "rgba(220, 193, 130, 0.16)"
        : controlSplitOverlay
          ? DEFAULT_FILL
          : buildBaseFill(displayMode, resolved);

  const zIndex =
    selectionState === "active" ? 10 : selectionState === "selected" ? 8 : 1;
  const cacheKey = buildCacheKey(
    displayMode,
    selectionState,
    resolved,
    controlSplitOverlay !== null,
    strokeColor,
    strokeWidth,
    zIndex,
  );
  let style = styleCache.get(cacheKey);

  if (!style) {
    style = new Style({
      fill: new Fill({
        color: fillColorWithSelection,
      }),
      stroke: new Stroke({
        color: strokeColor,
        width: strokeWidth,
      }),
      zIndex,
    });

    styleCache.set(cacheKey, style);
  }

  const overlays = getCasePatternOverlays({
    displayMode,
    properties,
    styles,
  });

  if (overlays.length === 0) {
    return style;
  }

  return [
    style,
    ...overlays.map((overlay, index) =>
      getOverlayStyle(overlay, zIndex, index),
    ),
  ];
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
  const resolved = resolveBaseStyle(displayMode, properties, styles);
  const controlSplitOverlay = resolveControlSplitOverlay(
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
    });
  }

  if (displayMode === "topographic" && properties?.colline === true) {
    const hillStyle = getStyleForTarget(styles, "case_attribute", "colline");
    overlays.push({
      type: "pattern",
      patternType: hillStyle?.pattern_type ?? HILL_PATTERN_TYPE,
      patternColor: hillStyle?.pattern_color ?? HILL_PATTERN_COLOR,
    });
  }

  return overlays;
}
