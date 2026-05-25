"use client";

import { createStylePreview, getPatternCss } from "@/components/admin/tech/reference-utils";
import type { StylePreviewProps } from "@/components/admin/tech/types";
import { normalizeHexColor } from "@/map/types";

export function StylePreview({ fill, stroke, patternType, patternColor }: StylePreviewProps) {
  const preview = createStylePreview(fill, stroke, patternType, patternColor);
  const patternCss = getPatternCss(preview.patternType, preview.patternColor);

  return (
    <div
      className="h-10 w-16 rounded-[12px] border"
      style={{
        backgroundColor: normalizeHexColor(fill) ? preview.fill : "transparent",
        ...patternCss,
        borderColor: preview.stroke,
      }}
      aria-hidden="true"
    />
  );
}
