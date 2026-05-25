"use client";

import { useState } from "react";

import { isPreviewImageUrl } from "@/components/admin/tech/reference-utils";
import type { ImagePreviewProps } from "@/components/admin/tech/types";

export function ImagePreview({ imageUrl, imageAlt }: ImagePreviewProps) {
  const [hasError, setHasError] = useState(false);
  const trimmedUrl = imageUrl.trim();

  if (!trimmedUrl) {
    return <p className="text-sm text-muted-foreground">Aucune image renseignee.</p>;
  }

  if (!isPreviewImageUrl(trimmedUrl)) {
    return <p className="text-sm text-muted-foreground">Image non disponible pour l’instant.</p>;
  }

  if (hasError) {
    return <p className="text-sm text-muted-foreground">Impossible de charger l’image pour l’instant.</p>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={trimmedUrl}
      alt={imageAlt.trim() || "Apercu de l’icone"}
      className="max-h-28 max-w-full rounded-[14px] border border-border/60 bg-background/35 p-2"
      onError={() => setHasError(true)}
    />
  );
}
