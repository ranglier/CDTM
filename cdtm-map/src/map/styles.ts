import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

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
const PATTERN_TILE_SIZE = 12;
const PATTERN_STEP = 6;

const styleCache = new Map<string, Style>();
const patternCache = new Map<string, CanvasPattern | null>();

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

function mergeTopographicStyles(
  terrainStyle: ResolvedStyle | null,
  reliefStyle: ResolvedStyle | null,
): ResolvedStyle | null {
  if (!terrainStyle && !reliefStyle) {
    return null;
  }

  return {
    fill: terrainStyle?.fill ?? reliefStyle?.fill ?? null,
    stroke: terrainStyle?.stroke ?? reliefStyle?.stroke ?? null,
    pattern_type: reliefStyle?.pattern_type ?? terrainStyle?.pattern_type ?? null,
    pattern_color: reliefStyle?.pattern_color ?? terrainStyle?.pattern_color ?? null,
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
      return mergeTopographicStyles(
        getStyleForTarget(styles, "terrain_type", properties.terrain_type),
        getStyleForTarget(styles, "relief", properties.relief),
      );
    default:
      return null;
  }
}

function drawDiagonalPattern(
  context: CanvasRenderingContext2D,
  reverse = false,
) {
  for (let offset = -PATTERN_TILE_SIZE; offset <= PATTERN_TILE_SIZE * 2; offset += PATTERN_STEP) {
    if (reverse) {
      context.moveTo(offset, 0);
      context.lineTo(offset + PATTERN_TILE_SIZE, PATTERN_TILE_SIZE);
    } else {
      context.moveTo(offset, PATTERN_TILE_SIZE);
      context.lineTo(offset + PATTERN_TILE_SIZE, 0);
    }
  }
}

function drawHorizontalPattern(context: CanvasRenderingContext2D) {
  for (let y = 2; y < PATTERN_TILE_SIZE; y += PATTERN_STEP) {
    context.moveTo(0, y);
    context.lineTo(PATTERN_TILE_SIZE, y);
  }
}

function drawVerticalPattern(context: CanvasRenderingContext2D) {
  for (let x = 2; x < PATTERN_TILE_SIZE; x += PATTERN_STEP) {
    context.moveTo(x, 0);
    context.lineTo(x, PATTERN_TILE_SIZE);
  }
}

function createCanvasPattern(
  fill: string | null,
  patternType: MapPatternType | null,
  patternColor: string | null,
): CanvasPattern | null {
  if (!patternType || typeof document === "undefined") {
    return null;
  }

  const normalizedFill = normalizeHexColor(fill);
  const normalizedPatternColor = normalizeHexColor(patternColor) ?? DEFAULT_PATTERN_COLOR;
  const cacheKey = `${normalizedFill ?? "transparent"}|${patternType}|${normalizedPatternColor}`;
  const cached = patternCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = PATTERN_TILE_SIZE;
  canvas.height = PATTERN_TILE_SIZE;
  const context = canvas.getContext("2d");

  if (!context) {
    patternCache.set(cacheKey, null);
    return null;
  }

  context.clearRect(0, 0, PATTERN_TILE_SIZE, PATTERN_TILE_SIZE);

  if (normalizedFill) {
    context.fillStyle = normalizedFill;
    context.fillRect(0, 0, PATTERN_TILE_SIZE, PATTERN_TILE_SIZE);
  }

  context.strokeStyle = normalizedPatternColor;
  context.fillStyle = normalizedPatternColor;
  context.lineWidth = 1.25;
  context.beginPath();

  switch (patternType) {
    case "diagonal":
      drawDiagonalPattern(context, false);
      context.stroke();
      break;
    case "diagonal_reverse":
      drawDiagonalPattern(context, true);
      context.stroke();
      break;
    case "crosshatch":
      drawDiagonalPattern(context, false);
      drawDiagonalPattern(context, true);
      context.stroke();
      break;
    case "horizontal":
      drawHorizontalPattern(context);
      context.stroke();
      break;
    case "vertical":
      drawVerticalPattern(context);
      context.stroke();
      break;
    case "grid":
      drawHorizontalPattern(context);
      drawVerticalPattern(context);
      context.stroke();
      break;
    case "dots":
      context.closePath();
      for (let x = 3; x < PATTERN_TILE_SIZE; x += PATTERN_STEP) {
        for (let y = 3; y < PATTERN_TILE_SIZE; y += PATTERN_STEP) {
          context.beginPath();
          context.arc(x, y, 1.2, 0, Math.PI * 2);
          context.fill();
        }
      }
      break;
  }

  const pattern = context.createPattern(canvas, "repeat");
  patternCache.set(cacheKey, pattern);
  return pattern;
}

function buildBaseFill(
  _displayMode: MapDisplayMode,
  style: ResolvedStyle | null,
): string | CanvasPattern {
  if (!style) {
    return DEFAULT_FILL;
  }

  const pattern = createCanvasPattern(style.fill, style.pattern_type, style.pattern_color);

  if (pattern) {
    return pattern;
  }

  return style.fill ?? DEFAULT_FILL;
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
}: CaseStyleOptions): Style {
  const resolved = resolveBaseStyle(displayMode, properties, styles);
  const baseStrokeColor = resolved?.stroke ?? DEFAULT_STROKE;

  const strokeColor =
    selectionState === "active"
      ? "rgba(220, 193, 130, 0.98)"
      : selectionState === "selected"
        ? "rgba(174, 150, 98, 0.92)"
        : baseStrokeColor;

  const strokeWidth =
    selectionState === "active" ? 2.2 : selectionState === "selected" ? 1.9 : DEFAULT_STROKE_WIDTH;

  const fillColorWithSelection: string | CanvasPattern = buildBaseFill(displayMode, resolved);

  const zIndex = selectionState === "active" ? 10 : selectionState === "selected" ? 8 : 1;
  const cacheKey = buildCacheKey(displayMode, selectionState, resolved, strokeColor, strokeWidth, zIndex);
  const cached = styleCache.get(cacheKey);

  if (cached) {
    return cached;
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
  return style;
}
