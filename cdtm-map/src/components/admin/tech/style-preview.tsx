"use client";

import { useEffect, useMemo, useRef } from "react";

import { createStylePreview } from "@/components/admin/tech/reference-utils";
import { renderStylePreview } from "@/components/admin/tech/style-preview-renderer";
import type { StylePreviewProps } from "@/components/admin/tech/types";
import { normalizeHexColor } from "@/map/types";

export function StylePreview({
  fill,
  stroke,
  patternType,
  patternColor,
  patternSpacing,
  patternLineWidth,
  patternDotRadius,
}: StylePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const preview = createStylePreview(
    fill,
    stroke,
    patternType,
    patternColor,
    patternSpacing,
    patternLineWidth,
    patternDotRadius,
  );
  const normalizedFill = normalizeHexColor(fill);
  const previewLabel = useMemo(
    () =>
      preview.patternType
        ? `Apercu du motif ${preview.patternType}`
        : "Aucun motif",
    [preview.patternType],
  );

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    renderStylePreview({
      canvas: canvasRef.current,
      fill: normalizedFill,
      stroke: preview.stroke,
      patternType: preview.patternType,
      patternColor: preview.patternColor,
      patternSpacing: preview.patternSpacing,
      patternLineWidth: preview.patternLineWidth,
      patternDotRadius: preview.patternDotRadius,
      pixelRatio: window.devicePixelRatio,
    });
  }, [
    normalizedFill,
    preview.patternDotRadius,
    preview.patternLineWidth,
    preview.patternColor,
    preview.patternSpacing,
    preview.patternType,
    preview.stroke,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="h-10 w-16 rounded-[12px]"
      role="img"
      aria-label={previewLabel}
      title={previewLabel}
    />
  );
}
