import {
  MAP_PUBLIC_MOBILE_LOD_BONUS,
  MAP_PUBLIC_OBJECT_LOD_RESOLUTION,
  MAP_PUBLIC_ROUTE_LOD_RESOLUTION,
} from "./config.ts";
import type { CdtmMapObjectDisplayMode } from "./use-cdtm-map-runtime.ts";

export const MAP_PUBLIC_ROUTE_FULL_SEGMENTS = 12;
export const MAP_PUBLIC_ROUTE_LOD_SEGMENTS = 4;

function normalizeResolution(resolution: number | undefined): number | null {
  return typeof resolution === "number" && Number.isFinite(resolution)
    ? resolution
    : null;
}

export function getPublicLodResolutionThreshold(
  baseResolution: number,
  mobile: boolean,
): number {
  return mobile
    ? baseResolution / MAP_PUBLIC_MOBILE_LOD_BONUS
    : baseResolution;
}

export function shouldUsePublicObjectLod(
  resolution: number | undefined,
  mobile: boolean,
): boolean {
  const normalizedResolution = normalizeResolution(resolution);

  if (normalizedResolution === null) {
    return false;
  }

  return (
    normalizedResolution >=
    getPublicLodResolutionThreshold(MAP_PUBLIC_OBJECT_LOD_RESOLUTION, mobile)
  );
}

export function shouldUsePublicRouteLod(
  resolution: number | undefined,
  mobile: boolean,
): boolean {
  const normalizedResolution = normalizeResolution(resolution);

  if (normalizedResolution === null) {
    return false;
  }

  return (
    normalizedResolution >=
    getPublicLodResolutionThreshold(MAP_PUBLIC_ROUTE_LOD_RESOLUTION, mobile)
  );
}

export function resolvePublicObjectDisplayMode(
  requestedMode: CdtmMapObjectDisplayMode,
  resolution: number | undefined,
  mobile: boolean,
): CdtmMapObjectDisplayMode {
  if (requestedMode === "icons" && shouldUsePublicObjectLod(resolution, mobile)) {
    return "points";
  }

  return requestedMode;
}

export function getPublicRouteSegmentsPerInterval(
  resolution: number | undefined,
  mobile: boolean,
): number {
  return shouldUsePublicRouteLod(resolution, mobile)
    ? MAP_PUBLIC_ROUTE_LOD_SEGMENTS
    : MAP_PUBLIC_ROUTE_FULL_SEGMENTS;
}

export function getPublicObjectHitTolerance(
  resolution: number | undefined,
  mobile: boolean,
): number {
  return shouldUsePublicObjectLod(resolution, mobile) ? 8 : 10;
}

export function getPublicRouteHitTolerance(
  resolution: number | undefined,
  mobile: boolean,
): number {
  return shouldUsePublicRouteLod(resolution, mobile) ? 6 : 8;
}

export function getPublicPointerMoveThrottleMs(
  resolution: number | undefined,
  mobile: boolean,
): number {
  if (mobile) {
    return 140;
  }

  return shouldUsePublicObjectLod(resolution, mobile) ||
    shouldUsePublicRouteLod(resolution, mobile)
    ? 80
    : 0;
}
