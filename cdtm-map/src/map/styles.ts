import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

import {
  normalizeHexColor,
  normalizeOpacityValue,
  type MapDisplayMode,
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

const DEFAULT_FILL = "rgba(0, 0, 0, 0)";
const DEFAULT_STROKE = "rgba(0, 0, 0, 0.96)";
const DEFAULT_STROKE_WIDTH = 1.2;

const styleCache = new Map<string, Style>();

function hexToRgb(color: string): [number, number, number] | null {
  const normalized = normalizeHexColor(color);

  if (!normalized) {
    return null;
  }

  const hex = normalized.slice(1);
  const expanded = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex;

  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

function toRgba(color: string | null, opacity: number | null, fallback: string): string {
  if (!color) {
    return fallback;
  }

  const rgb = hexToRgb(color);

  if (!rgb) {
    return fallback;
  }

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity ?? 1})`;
}

function getStyleForTarget(
  styles: PublicMapStyles,
  targetType: keyof PublicMapStyles,
  targetId: string | null | undefined,
) {
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
    opacity: normalizeOpacityValue(style.opacity),
  };
}

function resolveBaseStyle(
  displayMode: MapDisplayMode,
  properties: StableCaseProperties | null,
  styles: PublicMapStyles,
) {
  if (displayMode === "political" && properties) {
    return (
      getStyleForTarget(styles, "controleur", properties.controleur) ??
      getStyleForTarget(styles, "faction", properties.faction)
    );
  }

  if (displayMode === "topographic" && properties) {
    return (
      getStyleForTarget(styles, "terrain_type", properties.terrain_type) ??
      getStyleForTarget(styles, "relief", properties.relief)
    );
  }

  return null;
}

export function getCaseStyle({
  selectionState,
  displayMode,
  properties,
  styles,
}: CaseStyleOptions): Style {
  const resolved = resolveBaseStyle(displayMode, properties, styles);
  const fillOpacity =
    displayMode === "neutral" ? 0 : resolved?.fill ? (resolved.opacity ?? 1) : 0;
  const fillColor = toRgba(resolved?.fill ?? null, fillOpacity, DEFAULT_FILL);
  const baseStrokeColor = toRgba(resolved?.stroke ?? null, 0.96, DEFAULT_STROKE);

  const strokeColor =
    selectionState === "active"
      ? "rgba(220, 193, 130, 0.98)"
      : selectionState === "selected"
        ? "rgba(174, 150, 98, 0.92)"
        : baseStrokeColor;

  const strokeWidth =
    selectionState === "active" ? 2.2 : selectionState === "selected" ? 1.9 : DEFAULT_STROKE_WIDTH;

  const fillColorWithSelection =
    selectionState === "active"
      ? "rgba(33, 30, 26, 0.34)"
      : selectionState === "selected"
        ? "rgba(94, 82, 57, 0.18)"
        : fillColor;

  const zIndex = selectionState === "active" ? 10 : selectionState === "selected" ? 8 : 1;
  const cacheKey = `${displayMode}|${selectionState}|${fillColorWithSelection}|${strokeColor}|${strokeWidth}|${zIndex}`;
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
