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
const MIN_VISIBLE_PATTERN_STEP = 7;
const MIN_VISIBLE_PATTERN_LINE_WIDTH = 1.45;
const MIN_VISIBLE_PATTERN_DOT_RADIUS = 1.45;
const CONTROL_SPLIT_MIN_VISIBLE_STEP = 12;
const CONTROL_SPLIT_MIN_VISIBLE_BAND_WIDTH = 3;
const CONTROL_SPLIT_OVERLAY_ALPHA = 0.88;
const TRANSPARENT_CONTROL_COLOR = "rgba(0, 0, 0, 0)";
const SCREEN_PATTERN_ANCHOR: PixelAnchor = { x: 0, y: 0 };

const styleCache = new Map<string, Style>();
const patternOverlayCache = new Map<string, Style>();
const controlSplitOverlayCache = new Map<string, Style>();
const patternTileCache = new Map<string, CanvasImageSource>();
const canvasPatternCache = new WeakMap<
  CanvasRenderingContext2D,
  Map<string, CanvasPattern>
>();

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

type PixelExtent = [number, number, number, number];
type PixelAnchor = { x: number; y: number };

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

function normalizeCanvasPixelRatio(pixelRatio: number): number {
  return Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
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

function drawHorizontalLines(
  context: CanvasRenderingContext2D,
  extent: PixelExtent,
  anchor: PixelAnchor,
  step: number,
) {
  const [minX, minY, maxX, maxY] = extent;
  const startY = getFirstAlignedPosition(minY - step, anchor.y, step);

  for (let y = startY; y <= maxY + step; y += step) {
    context.moveTo(minX - step, y);
    context.lineTo(maxX + step, y);
  }
}

function drawVerticalLines(
  context: CanvasRenderingContext2D,
  extent: PixelExtent,
  anchor: PixelAnchor,
  step: number,
) {
  const [minX, minY, maxX, maxY] = extent;
  const startX = getFirstAlignedPosition(minX - step, anchor.x, step);

  for (let x = startX; x <= maxX + step; x += step) {
    context.moveTo(x, minY - step);
    context.lineTo(x, maxY + step);
  }
}

function drawDiagonalLines(
  context: CanvasRenderingContext2D,
  extent: PixelExtent,
  anchor: PixelAnchor,
  step: number,
  reverse = false,
) {
  const [minX, minY, maxX, maxY] = extent;
  const padding = Math.max(maxX - minX, maxY - minY) + step;

  if (reverse) {
    const minConstant = minY - maxX - padding;
    const maxConstant = maxY - minX + padding;
    const anchorConstant = anchor.y - anchor.x;
    const start = getFirstAlignedPosition(minConstant, anchorConstant, step);

    for (let constant = start; constant <= maxConstant; constant += step) {
      context.moveTo(minX - padding, minX - padding + constant);
      context.lineTo(maxX + padding, maxX + padding + constant);
    }

    return;
  }

  const minConstant = minX + minY - padding;
  const maxConstant = maxX + maxY + padding;
  const anchorConstant = anchor.x + anchor.y;
  const start = getFirstAlignedPosition(minConstant, anchorConstant, step);

  for (let constant = start; constant <= maxConstant; constant += step) {
    context.moveTo(minX - padding, constant - (minX - padding));
    context.lineTo(maxX + padding, constant - (maxX + padding));
  }
}

function drawDots(
  context: CanvasRenderingContext2D,
  extent: PixelExtent,
  anchor: PixelAnchor,
  step: number,
  radius: number,
) {
  const [minX, minY, maxX, maxY] = extent;
  const startX = getFirstAlignedPosition(minX - step, anchor.x, step);
  const startY = getFirstAlignedPosition(minY - step, anchor.y, step);

  for (let x = startX; x <= maxX + step; x += step) {
    for (let y = startY; y <= maxY + step; y += step) {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function createPatternCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const canvasWidth = Math.max(1, Math.ceil(width));
  const canvasHeight = Math.max(1, Math.ceil(height));

  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  return canvas;
}

function getPatternCanvasSize(canvas: CanvasImageSource): {
  width: number;
  height: number;
} {
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    canvas instanceof HTMLCanvasElement
  ) {
    return { width: canvas.width, height: canvas.height };
  }

  if (
    typeof OffscreenCanvas !== "undefined" &&
    canvas instanceof OffscreenCanvas
  ) {
    return { width: canvas.width, height: canvas.height };
  }

  return { width: 1, height: 1 };
}

function getPatternTile(
  patternType: MapPatternType,
  patternColor: string,
  pixelRatio: number,
): CanvasImageSource | null {
  const ratio = normalizeCanvasPixelRatio(pixelRatio);
  const spec = getPatternSpec(patternType);
  const step = Math.max(MIN_VISIBLE_PATTERN_STEP, spec.step) * ratio;
  const lineWidth =
    Math.max(MIN_VISIBLE_PATTERN_LINE_WIDTH, spec.lineWidth) * ratio;
  const dotRadius =
    Math.max(MIN_VISIBLE_PATTERN_DOT_RADIUS, spec.dotRadius) * ratio;
  const cacheKey = [
    "pattern",
    patternType,
    patternColor,
    Math.round(ratio * 100),
  ].join("|");
  const cached = patternTileCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const canvas = createPatternCanvas(step, step);
  const context = canvas?.getContext("2d") ?? null;

  if (!canvas || !context) {
    return null;
  }

  context.strokeStyle = patternColor;
  context.fillStyle = patternColor;
  context.lineWidth = lineWidth;
  context.lineCap = "round";

  if (spec.kind === "dots") {
    drawDots(
      context,
      [0, 0, step, step],
      SCREEN_PATTERN_ANCHOR,
      step,
      dotRadius,
    );
  } else {
    context.beginPath();

    switch (spec.kind) {
      case "diagonal":
        drawDiagonalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
          false,
        );
        break;
      case "diagonal_reverse":
        drawDiagonalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
          true,
        );
        break;
      case "crosshatch":
        drawDiagonalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
          false,
        );
        drawDiagonalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
          true,
        );
        break;
      case "horizontal":
        drawHorizontalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
        );
        break;
      case "vertical":
        drawVerticalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
        );
        break;
      case "grid":
        drawHorizontalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
        );
        drawVerticalLines(
          context,
          [0, 0, step, step],
          SCREEN_PATTERN_ANCHOR,
          step,
        );
        break;
    }

    context.stroke();
  }

  patternTileCache.set(cacheKey, canvas);
  return canvas;
}

function getContextPattern(
  context: CanvasRenderingContext2D,
  cacheKey: string,
  tile: CanvasImageSource,
): CanvasPattern | null {
  let contextCache = canvasPatternCache.get(context);

  if (!contextCache) {
    contextCache = new Map();
    canvasPatternCache.set(context, contextCache);
  }

  const cached = contextCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pattern = context.createPattern(tile, "repeat");

  if (pattern) {
    contextCache.set(cacheKey, pattern);
  }

  return pattern;
}

function fillClippedWithPattern(
  context: CanvasRenderingContext2D,
  coordinates: unknown,
  pattern: CanvasPattern,
) {
  const canvasSize = getPatternCanvasSize(context.canvas);

  context.save();
  context.beginPath();
  appendGeometryPath(context, coordinates);
  context.clip("evenodd");
  context.fillStyle = pattern;
  context.fillRect(0, 0, canvasSize.width, canvasSize.height);
  context.restore();
}

function getPatternOverlayStyle(
  patternType: MapPatternType,
  patternColor: string,
  zIndex: number,
): Style {
  const cacheKey = `${patternType}|${patternColor}|${zIndex}`;
  const cached = patternOverlayCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const renderer: RenderFunction = (coordinates, state) => {
    const tile = getPatternTile(patternType, patternColor, state.pixelRatio);

    if (!tile) {
      return;
    }

    const pattern = getContextPattern(
      state.context,
      [
        "pattern",
        patternType,
        patternColor,
        Math.round(normalizeCanvasPixelRatio(state.pixelRatio) * 100),
      ].join("|"),
      tile,
    );

    if (!pattern) {
      return;
    }

    fillClippedWithPattern(state.context, coordinates, pattern);
  };

  const style = new Style({
    renderer,
    zIndex,
  });
  patternOverlayCache.set(cacheKey, style);
  return style;
}

function drawControlSplitBands(
  context: CanvasRenderingContext2D,
  extent: PixelExtent,
  anchor: PixelAnchor,
  overlay: ControlSplitOverlay,
) {
  const spec = getPatternSpec(overlay.patternType);
  const step = Math.max(CONTROL_SPLIT_MIN_VISIBLE_STEP, spec.step);
  const hasEmptySecondaryBands =
    overlay.secondaryColor === TRANSPARENT_CONTROL_COLOR;
  const rawBandWidth = hasEmptySecondaryBands
    ? step * (1 - overlay.secondaryRatio)
    : step * overlay.secondaryRatio;
  const bandWidth =
    rawBandWidth <= 0
      ? 0
      : Math.min(
          step,
          Math.max(CONTROL_SPLIT_MIN_VISIBLE_BAND_WIDTH, rawBandWidth),
        );
  const [minX, minY, maxX, maxY] = extent;
  const padding = Math.max(maxX - minX, maxY - minY) + step * 2;

  if (!hasEmptySecondaryBands) {
    context.fillStyle = overlay.primaryColor;
    context.fillRect(
      minX - padding,
      minY - padding,
      maxX - minX + padding * 2,
      maxY - minY + padding * 2,
    );
  }

  context.fillStyle = hasEmptySecondaryBands
    ? overlay.primaryColor
    : overlay.secondaryColor;

  function fillHorizontalBands() {
    const startY = getFirstAlignedPosition(minY - padding, anchor.y, step);

    for (let y = startY; y <= maxY + padding; y += step) {
      context.fillRect(minX - padding, y, maxX - minX + padding * 2, bandWidth);
    }
  }

  function fillVerticalBands() {
    const startX = getFirstAlignedPosition(minX - padding, anchor.x, step);

    for (let x = startX; x <= maxX + padding; x += step) {
      context.fillRect(x, minY - padding, bandWidth, maxY - minY + padding * 2);
    }
  }

  function fillDiagonalBands(reverse = false) {
    if (bandWidth <= 0) {
      return;
    }

    const minConstant = reverse ? minY - maxX - padding : minX + minY - padding;
    const maxConstant = reverse ? maxY - minX + padding : maxX + maxY + padding;
    const anchorConstant = reverse ? anchor.y - anchor.x : anchor.x + anchor.y;
    const start = getFirstAlignedPosition(minConstant, anchorConstant, step);

    for (let constant = start; constant <= maxConstant; constant += step) {
      const nextConstant = constant + bandWidth;

      context.beginPath();

      if (reverse) {
        context.moveTo(minX - padding, minX - padding + constant);
        context.lineTo(maxX + padding, maxX + padding + constant);
        context.lineTo(maxX + padding, maxX + padding + nextConstant);
        context.lineTo(minX - padding, minX - padding + nextConstant);
      } else {
        context.moveTo(minX - padding, constant - (minX - padding));
        context.lineTo(maxX + padding, constant - (maxX + padding));
        context.lineTo(maxX + padding, nextConstant - (maxX + padding));
        context.lineTo(minX - padding, nextConstant - (minX - padding));
      }

      context.closePath();
      context.fill();
    }
  }

  function fillDots() {
    if (bandWidth <= 0) {
      return;
    }

    const radius = Math.max(1, Math.min(step * 0.35, bandWidth * 0.5));
    const startX = getFirstAlignedPosition(minX - padding, anchor.x, step);
    const startY = getFirstAlignedPosition(minY - padding, anchor.y, step);

    for (let x = startX; x <= maxX + padding; x += step) {
      for (let y = startY; y <= maxY + padding; y += step) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
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

function getControlSplitTile(
  overlay: ControlSplitOverlay,
  pixelRatio: number,
): CanvasImageSource | null {
  const ratio = normalizeCanvasPixelRatio(pixelRatio);
  const spec = getPatternSpec(overlay.patternType);
  const step = Math.max(CONTROL_SPLIT_MIN_VISIBLE_STEP, spec.step) * ratio;
  const cacheKey = [
    "control",
    overlay.primaryColor,
    overlay.secondaryColor,
    overlay.secondaryRatio,
    overlay.patternType,
    Math.round(ratio * 100),
  ].join("|");
  const cached = patternTileCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const canvas = createPatternCanvas(step, step);
  const context = canvas?.getContext("2d") ?? null;

  if (!canvas || !context) {
    return null;
  }

  context.scale(ratio, ratio);
  drawControlSplitBands(
    context,
    [0, 0, step / ratio, step / ratio],
    SCREEN_PATTERN_ANCHOR,
    overlay,
  );

  patternTileCache.set(cacheKey, canvas);
  return canvas;
}

function getControlSplitOverlayStyle(
  overlay: ControlSplitOverlay,
  zIndex: number,
): Style {
  const cacheKey = [
    overlay.primaryColor,
    overlay.secondaryColor,
    overlay.secondaryRatio,
    overlay.patternType,
    zIndex,
  ].join("|");
  const cached = controlSplitOverlayCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const renderer: RenderFunction = (coordinates, state) => {
    const tile = getControlSplitTile(overlay, state.pixelRatio);

    if (!tile) {
      return;
    }

    const pattern = getContextPattern(
      state.context,
      [
        "control",
        overlay.primaryColor,
        overlay.secondaryColor,
        overlay.secondaryRatio,
        overlay.patternType,
        Math.round(normalizeCanvasPixelRatio(state.pixelRatio) * 100),
      ].join("|"),
      tile,
    );

    if (!pattern) {
      return;
    }

    state.context.save();
    state.context.globalAlpha = CONTROL_SPLIT_OVERLAY_ALPHA;
    fillClippedWithPattern(state.context, coordinates, pattern);
    state.context.restore();
  };

  const style = new Style({
    renderer,
    zIndex,
  });
  controlSplitOverlayCache.set(cacheKey, style);
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
  const cached = styleCache.get(cacheKey);

  if (cached) {
    const overlayStyles = getCaseOverlayStyles(
      resolved,
      properties,
      styles,
      displayMode,
      zIndex,
      controlSplitOverlay,
    );
    return overlayStyles.length > 0 ? [cached, ...overlayStyles] : cached;
  }

  const style = new Style({
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
  const overlayStyles = getCaseOverlayStyles(
    resolved,
    properties,
    styles,
    displayMode,
    zIndex,
    controlSplitOverlay,
  );
  return overlayStyles.length > 0 ? [style, ...overlayStyles] : style;
}

function getCaseOverlayStyles(
  resolved: ResolvedStyle | null,
  properties: StableCaseProperties | null,
  styles: PublicMapStyles,
  displayMode: MapDisplayMode,
  baseZIndex: number,
  controlSplitOverlay: ControlSplitOverlay | null,
): Style[] {
  const overlays: Style[] = [];

  if (controlSplitOverlay) {
    overlays.push(
      getControlSplitOverlayStyle(controlSplitOverlay, baseZIndex + 0.05),
    );
  }

  if (resolved?.pattern_type) {
    overlays.push(
      getPatternOverlayStyle(
        resolved.pattern_type,
        resolved.pattern_color ?? DEFAULT_PATTERN_COLOR,
        baseZIndex + 0.1,
      ),
    );
  }

  if (displayMode === "topographic" && properties?.colline === true) {
    const hillStyle = getStyleForTarget(styles, "case_attribute", "colline");
    overlays.push(
      getPatternOverlayStyle(
        hillStyle?.pattern_type ?? HILL_PATTERN_TYPE,
        hillStyle?.pattern_color ?? HILL_PATTERN_COLOR,
        baseZIndex + 0.2,
      ),
    );
  }

  return overlays;
}
