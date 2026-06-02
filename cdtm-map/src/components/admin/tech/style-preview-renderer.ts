import {
  generatePatternPrimitives,
  getPatternSpec,
  type MapExtent,
  type MapPoint,
} from "@/map/case-patterns";
import { type MapPatternType } from "@/map/types";

export type StylePreviewRenderOptions = {
  canvas: HTMLCanvasElement;
  fill: string | null;
  stroke: string;
  patternType: MapPatternType | null;
  patternColor: string;
  patternSpacing?: number | null;
  patternLineWidth?: number | null;
  patternDotRadius?: number | null;
  pixelRatio?: number;
};

const PREVIEW_WIDTH = 64;
const PREVIEW_HEIGHT = 40;
const PREVIEW_RADIUS = 12;
const PREVIEW_EXTENT: MapExtent = [0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT];

function appendRoundedRectPath(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.moveTo(safeRadius, 0);
  context.lineTo(width - safeRadius, 0);
  context.quadraticCurveTo(width, 0, width, safeRadius);
  context.lineTo(width, height - safeRadius);
  context.quadraticCurveTo(width, height, width - safeRadius, height);
  context.lineTo(safeRadius, height);
  context.quadraticCurveTo(0, height, 0, height - safeRadius);
  context.lineTo(0, safeRadius);
  context.quadraticCurveTo(0, 0, safeRadius, 0);
  context.closePath();
}

function toPreviewPixel(coordinate: MapPoint): MapPoint {
  return [coordinate[0], PREVIEW_HEIGHT - coordinate[1]];
}

export function renderStylePreview({
  canvas,
  fill,
  stroke,
  patternType,
  patternColor,
  patternSpacing,
  patternLineWidth,
  patternDotRadius,
  pixelRatio = 1,
}: StylePreviewRenderOptions): void {
  const ratio = Math.max(1, pixelRatio);
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = Math.round(PREVIEW_WIDTH * ratio);
  canvas.height = Math.round(PREVIEW_HEIGHT * ratio);
  canvas.style.width = `${PREVIEW_WIDTH}px`;
  canvas.style.height = `${PREVIEW_HEIGHT}px`;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  context.save();
  context.beginPath();
  appendRoundedRectPath(
    context,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    PREVIEW_RADIUS,
  );
  context.clip();

  if (fill) {
    context.fillStyle = fill;
    context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  }

  if (patternType) {
    const patternOverrides = {
      patternSpacing,
      patternLineWidth,
      patternDotRadius,
    };
    const spec = getPatternSpec(patternType, patternOverrides);
    const primitives = generatePatternPrimitives(
      patternType,
      PREVIEW_EXTENT,
      patternOverrides,
    );

    context.strokeStyle = patternColor;
    context.fillStyle = patternColor;
    context.lineWidth = Math.max(0.9, spec.lineWidth);
    context.lineCap = "round";

    context.beginPath();

    for (const primitive of primitives) {
      if (primitive.type !== "line") {
        continue;
      }

      const from = toPreviewPixel(primitive.from);
      const to = toPreviewPixel(primitive.to);
      context.moveTo(from[0], from[1]);
      context.lineTo(to[0], to[1]);
    }

    context.stroke();

    for (const primitive of primitives) {
      if (primitive.type !== "dot") {
        continue;
      }

      const center = toPreviewPixel(primitive.center);
      context.beginPath();
      context.arc(
        center[0],
        center[1],
        Math.max(0.9, spec.dotRadius),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  context.restore();

  context.beginPath();
  appendRoundedRectPath(
    context,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    PREVIEW_RADIUS,
  );
  context.strokeStyle = stroke;
  context.lineWidth = 1;
  context.stroke();
}
