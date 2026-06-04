import type { EditorMapRoute, EditorMapRoutePoint } from "@/editor/types";

export const DEFAULT_CURVED_ROUTE_SEGMENTS_PER_INTERVAL = 12;

export function buildRouteDisplayCoordinates(
  points: EditorMapRoutePoint[],
  geometryMode: EditorMapRoute["geometry_mode"],
  options: { segmentsPerInterval?: number } = {},
): EditorMapRoutePoint[] {
  if (geometryMode !== "curved") {
    return points;
  }

  if (points.length < 3) {
    return points;
  }

  const coordinates: EditorMapRoutePoint[] = [];
  const segmentsPerInterval =
    Number.isInteger(options.segmentsPerInterval) &&
    typeof options.segmentsPerInterval === "number" &&
    options.segmentsPerInterval >= 1
      ? options.segmentsPerInterval
      : DEFAULT_CURVED_ROUTE_SEGMENTS_PER_INTERVAL;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];

    for (let step = 0; step < segmentsPerInterval; step += 1) {
      const t = step / segmentsPerInterval;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      coordinates.push([x, y]);
    }
  }

  coordinates.push(points[points.length - 1]);
  return coordinates;
}
