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
};

const DEFAULT_FILL = "rgba(0, 0, 0, 0)";
const DEFAULT_STROKE = "#000000";
const DEFAULT_PATTERN_COLOR = "#000000";
const DEFAULT_STROKE_WIDTH = 1.2;
const HILL_PATTERN_TYPE: MapPatternType = "dots_spaced";
const HILL_PATTERN_COLOR = "rgba(40, 30, 14, 0.46)";
const PATTERN_STEP = 12;
const SPACED_PATTERN_STEP = 22;
const PATTERN_LINE_WIDTH = 1.25;
const MIN_VISIBLE_PATTERN_STEP = 7;
const MAX_LOW_ZOOM_PATTERN_SCALE = 2.4;
const CONTROL_SPLIT_OVERLAY_ALPHA = 0.88;

const styleCache = new Map<string, Style>();
const patternOverlayCache = new Map<string, Style>();
const controlSplitOverlayCache = new Map<string, Style>();

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

function getControlActorStyle(
  styles: PublicMapStyles,
  preferredTargetType: "faction" | "controleur",
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

  const faction = normalizeControlActor(properties.faction);
  const controller = normalizeControlActor(properties.controleur);

  if (!faction || !controller || faction === controller) {
    return null;
  }

  const factionStyle = getControlActorStyle(
    styles,
    "faction",
    properties.faction,
  );
  const controllerStyle = getControlActorStyle(
    styles,
    "controleur",
    properties.controleur,
  );
  const primaryColor = factionStyle?.fill;
  const secondaryColor = controllerStyle?.fill;

  if (!primaryColor || !secondaryColor || primaryColor === secondaryColor) {
    return null;
  }

  const controlStyle = getStyleForTarget(styles, "controle_type", controlType);

  return {
    primaryColor,
    secondaryColor,
    secondaryRatio: splitRule.secondaryRatio,
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

function getLowZoomPatternScale(resolution: number): number {
  if (!Number.isFinite(resolution) || resolution <= 1) {
    return 1;
  }

  return Math.min(
    MAX_LOW_ZOOM_PATTERN_SCALE,
    Math.max(1, Math.sqrt(resolution)),
  );
}

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function flattenCoordinates(value: unknown, output: Array<[number, number]>) {
  if (isCoordinate(value)) {
    output.push(value);
    return;
  }

  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    flattenCoordinates(item, output);
  }
}

function getPixelExtent(coordinates: unknown): PixelExtent | null {
  const flattened: Array<[number, number]> = [];
  flattenCoordinates(coordinates, flattened);

  if (flattened.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of flattened) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
}

function transformCoordinate(
  coordinate: [number, number],
  transform: DOMMatrixReadOnly,
): [number, number] {
  return [
    coordinate[0] * transform.a + coordinate[1] * transform.c + transform.e,
    coordinate[0] * transform.b + coordinate[1] * transform.d + transform.f,
  ];
}

function transformCoordinates(
  coordinates: unknown,
  transform: DOMMatrixReadOnly,
): unknown {
  if (isCoordinate(coordinates)) {
    return transformCoordinate(coordinates, transform);
  }

  if (!Array.isArray(coordinates)) {
    return coordinates;
  }

  return coordinates.map((item) => transformCoordinates(item, transform));
}

function transformAnchor(
  anchor: PixelAnchor,
  transform: DOMMatrixReadOnly,
): PixelAnchor {
  const [x, y] = transformCoordinate([anchor.x, anchor.y], transform);
  return { x, y };
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

function getPatternAnchor(
  pixelCoordinates: unknown,
  worldCoordinates: unknown,
  resolution: number,
): PixelAnchor {
  const pixels: Array<[number, number]> = [];
  const worlds: Array<[number, number]> = [];
  flattenCoordinates(pixelCoordinates, pixels);
  flattenCoordinates(worldCoordinates, worlds);

  const firstPixel = pixels[0];
  const firstWorld = worlds[0];

  if (!firstPixel || !firstWorld) {
    return { x: 0, y: 0 };
  }

  return {
    x: firstPixel[0] - firstWorld[0] / resolution,
    y: firstPixel[1] + firstWorld[1] / resolution,
  };
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

function drawAnchoredPattern(
  context: CanvasRenderingContext2D,
  extent: PixelExtent,
  anchor: PixelAnchor,
  patternType: MapPatternType,
  patternColor: string,
  pixelRatio: number,
  resolution: number,
) {
  const spec = getPatternSpec(patternType);
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const lowZoomScale = getLowZoomPatternScale(resolution);
  const step = Math.max(
    MIN_VISIBLE_PATTERN_STEP * ratio,
    (spec.step * ratio) / lowZoomScale,
  );
  const lineWidth = spec.lineWidth * ratio * Math.min(1.7, lowZoomScale);
  const dotRadius = spec.dotRadius * ratio * Math.min(1.8, lowZoomScale);

  context.strokeStyle = patternColor;
  context.fillStyle = patternColor;
  context.lineWidth = lineWidth;
  context.lineCap = "round";

  if (spec.kind === "dots") {
    drawDots(context, extent, anchor, step, dotRadius);
    return;
  }

  context.beginPath();

  switch (spec.kind) {
    case "diagonal":
      drawDiagonalLines(context, extent, anchor, step, false);
      break;
    case "diagonal_reverse":
      drawDiagonalLines(context, extent, anchor, step, true);
      break;
    case "crosshatch":
      drawDiagonalLines(context, extent, anchor, step, false);
      drawDiagonalLines(context, extent, anchor, step, true);
      break;
    case "horizontal":
      drawHorizontalLines(context, extent, anchor, step);
      break;
    case "vertical":
      drawVerticalLines(context, extent, anchor, step);
      break;
    case "grid":
      drawHorizontalLines(context, extent, anchor, step);
      drawVerticalLines(context, extent, anchor, step);
      break;
  }

  context.stroke();
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
    const safeResolution =
      Number.isFinite(state.resolution) && state.resolution > 0
        ? state.resolution
        : 1;
    const renderTransform = state.context.getTransform();
    const screenCoordinates = transformCoordinates(
      coordinates,
      renderTransform,
    );
    const screenExtent = getPixelExtent(screenCoordinates);

    if (!screenExtent) {
      return;
    }

    const worldCoordinates = state.geometry.getCoordinates();
    const anchor = getPatternAnchor(
      coordinates,
      worldCoordinates,
      safeResolution,
    );
    const screenAnchor = transformAnchor(anchor, renderTransform);

    state.context.save();
    state.context.setTransform(1, 0, 0, 1, 0, 0);
    state.context.beginPath();
    appendGeometryPath(state.context, screenCoordinates);
    state.context.clip("evenodd");
    drawAnchoredPattern(
      state.context,
      screenExtent,
      screenAnchor,
      patternType,
      patternColor,
      state.pixelRatio,
      safeResolution,
    );
    state.context.restore();
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
  pixelRatio: number,
) {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const spec = getPatternSpec(overlay.patternType);
  const step = Math.max(MIN_VISIBLE_PATTERN_STEP * ratio, spec.step * ratio);
  const secondaryWidth = step * overlay.secondaryRatio;
  const [minX, minY, maxX, maxY] = extent;
  const padding = Math.max(maxX - minX, maxY - minY) + step * 2;

  context.fillStyle = overlay.primaryColor;
  context.fillRect(
    minX - padding,
    minY - padding,
    maxX - minX + padding * 2,
    maxY - minY + padding * 2,
  );

  context.fillStyle = overlay.secondaryColor;

  function fillHorizontalBands() {
    const startY = getFirstAlignedPosition(minY - padding, anchor.y, step);

    for (let y = startY; y <= maxY + padding; y += step) {
      context.fillRect(
        minX - padding,
        y,
        maxX - minX + padding * 2,
        secondaryWidth,
      );
    }
  }

  function fillVerticalBands() {
    const startX = getFirstAlignedPosition(minX - padding, anchor.x, step);

    for (let x = startX; x <= maxX + padding; x += step) {
      context.fillRect(
        x,
        minY - padding,
        secondaryWidth,
        maxY - minY + padding * 2,
      );
    }
  }

  function fillDiagonalBands(reverse = false) {
    const minConstant = reverse ? minY - maxX - padding : minX + minY - padding;
    const maxConstant = reverse ? maxY - minX + padding : maxX + maxY + padding;
    const anchorConstant = reverse ? anchor.y - anchor.x : anchor.x + anchor.y;
    const start = getFirstAlignedPosition(minConstant, anchorConstant, step);

    for (let constant = start; constant <= maxConstant; constant += step) {
      const nextConstant = constant + secondaryWidth;

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
    case "dots":
      fillDiagonalBands(false);
      break;
  }
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
    const safeResolution =
      Number.isFinite(state.resolution) && state.resolution > 0
        ? state.resolution
        : 1;
    const renderTransform = state.context.getTransform();
    const screenCoordinates = transformCoordinates(
      coordinates,
      renderTransform,
    );
    const screenExtent = getPixelExtent(screenCoordinates);

    if (!screenExtent) {
      return;
    }

    const worldCoordinates = state.geometry.getCoordinates();
    const anchor = getPatternAnchor(
      coordinates,
      worldCoordinates,
      safeResolution,
    );
    const screenAnchor = transformAnchor(anchor, renderTransform);

    state.context.save();
    state.context.setTransform(1, 0, 0, 1, 0, 0);
    state.context.beginPath();
    appendGeometryPath(state.context, screenCoordinates);
    state.context.clip("evenodd");
    state.context.globalAlpha = CONTROL_SPLIT_OVERLAY_ALPHA;
    drawControlSplitBands(
      state.context,
      screenExtent,
      screenAnchor,
      overlay,
      state.pixelRatio,
    );
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
    selectionState === "active" && isUnstyled
      ? "rgba(220, 193, 130, 0.24)"
      : selectionState === "selected" && isUnstyled
        ? "rgba(220, 193, 130, 0.16)"
        : buildBaseFill(displayMode, resolved);

  const zIndex =
    selectionState === "active" ? 10 : selectionState === "selected" ? 8 : 1;
  const cacheKey = buildCacheKey(
    displayMode,
    selectionState,
    resolved,
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
  );
  return overlayStyles.length > 0 ? [style, ...overlayStyles] : style;
}

function getCaseOverlayStyles(
  resolved: ResolvedStyle | null,
  properties: StableCaseProperties | null,
  styles: PublicMapStyles,
  displayMode: MapDisplayMode,
  baseZIndex: number,
): Style[] {
  const overlays: Style[] = [];
  const controlSplitOverlay = resolveControlSplitOverlay(
    displayMode,
    properties,
    styles,
  );

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
