import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

import {
  resolveCaseBaseStyle,
  resolveCaseControlSplitOverlay,
  type ResolvedCaseStyle,
} from "@/map/case-patterns";
import {
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";

type SelectionState = "default" | "selected" | "active";
export type CaseStylePart = "full" | "fill" | "stroke" | "interaction";

type CaseStyleOptions = {
  selectionState: SelectionState;
  displayMode: MapDisplayMode;
  properties: StableCaseProperties | null;
  styles: PublicMapStyles;
  part?: CaseStylePart;
};

const DEFAULT_FILL = "rgba(0, 0, 0, 0)";
const DEFAULT_STROKE = "#000000";
const DEFAULT_STROKE_WIDTH = 1.2;
const TRANSPARENT_HIT_FILL = "rgba(0, 0, 0, 0)";

const styleCache = new Map<string, Style>();

function buildBaseFill(style: ResolvedCaseStyle | null): string {
  if (!style) {
    return DEFAULT_FILL;
  }

  return style.fill ?? DEFAULT_FILL;
}

function buildCacheKey({
  displayMode,
  selectionState,
  part,
  style,
  hasControlSplitOverlay,
  fillColor,
  strokeColor,
  strokeWidth,
  zIndex,
}: {
  displayMode: MapDisplayMode;
  selectionState: SelectionState;
  part: CaseStylePart;
  style: ResolvedCaseStyle | null;
  hasControlSplitOverlay: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  zIndex: number;
}) {
  return [
    displayMode,
    selectionState,
    part,
    style?.fill ?? "none",
    style?.stroke ?? DEFAULT_STROKE,
    hasControlSplitOverlay ? "control-split" : "normal",
    fillColor,
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
  part = "full",
}: CaseStyleOptions): Style {
  const resolved = resolveCaseBaseStyle(displayMode, properties, styles);
  const controlSplitOverlay = resolveCaseControlSplitOverlay(
    displayMode,
    properties,
    styles,
  );
  const isUnstyled = resolved === null;
  const hasControlSplitOverlay = controlSplitOverlay !== null;
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

  const interactionFillColor =
    selectionState === "active"
      ? "rgba(220, 193, 130, 0.18)"
      : selectionState === "selected"
        ? "rgba(220, 193, 130, 0.12)"
        : TRANSPARENT_HIT_FILL;
  const visualFillColor = part === "interaction"
    ? interactionFillColor
    : selectionState === "active" && isUnstyled && !hasControlSplitOverlay
      ? "rgba(220, 193, 130, 0.24)"
      : selectionState === "selected" && isUnstyled && !hasControlSplitOverlay
        ? "rgba(220, 193, 130, 0.16)"
        : hasControlSplitOverlay
          ? DEFAULT_FILL
          : buildBaseFill(resolved);
  const fillColor = part === "stroke" ? TRANSPARENT_HIT_FILL : visualFillColor;
  const zIndex =
    selectionState === "active" ? 10 : selectionState === "selected" ? 8 : 1;
  const cacheKey = buildCacheKey({
    displayMode,
    selectionState,
    part,
    style: resolved,
    hasControlSplitOverlay,
    fillColor,
    strokeColor,
    strokeWidth,
    zIndex,
  });
  const cached = styleCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const style = new Style({
    fill: new Fill({
      color: fillColor,
    }),
    stroke:
      part === "fill" ||
      (part === "interaction" && selectionState === "default")
        ? undefined
        : new Stroke({
            color: strokeColor,
            width: strokeWidth,
          }),
    zIndex,
  });

  styleCache.set(cacheKey, style);
  return style;
}
