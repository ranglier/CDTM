"use client";

import { useEffect, useRef } from "react";

import type Map from "ol/Map";

import {
  createCdtmBackgroundLayer,
  createCdtmMap,
  fitCdtmCasesExtent,
} from "@/map/openlayers/map-core";

export function EditorMapCanvas() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const backgroundLayer = createCdtmBackgroundLayer();
    const map = createCdtmMap(mapElementRef.current, [backgroundLayer]);

    mapRef.current = map;
    fitCdtmCasesExtent(map, 0);

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(mapElementRef.current);

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  return (
    <section className="relative h-[calc(100svh-8rem)] overflow-hidden rounded-[28px] bg-background/70">
      <div ref={mapElementRef} className="h-full w-full" aria-label="Carte editeur" />
    </section>
  );
}
