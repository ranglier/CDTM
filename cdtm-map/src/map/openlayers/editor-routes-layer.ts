import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import type Geometry from "ol/geom/Geometry";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

import type {
  EditorMapRoute,
  EditorMapRoutePoint,
  MapObjectStatus,
  MapRouteStrokeStyle,
} from "@/editor/types";

const DEFAULT_ROUTE_RGB = [255, 255, 255] as const;
const routeStyleCache = new Map<string, Style[]>();
const routePreviewPointStyle = new Style({
  image: new CircleStyle({
    radius: 4,
    fill: new Fill({ color: "rgba(245, 221, 150, 0.95)" }),
    stroke: new Stroke({ color: "rgba(18, 18, 18, 0.9)", width: 1.5 }),
  }),
});
const routePreviewLastPointStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 244, 194, 1)" }),
    stroke: new Stroke({ color: "rgba(18, 18, 18, 0.95)", width: 2 }),
  }),
});

type EditorRoutePreview = Pick<
  EditorMapRoute,
  | "name"
  | "route_type"
  | "points"
  | "geometry_mode"
  | "stroke_style"
  | "stroke_width"
  | "stroke_color"
  | "status"
>;

function isEditorMapRoute(value: unknown): value is EditorMapRoute {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id_route === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.route_type === "string" &&
    Array.isArray(candidate.points)
  );
}

function toRgba(color: string | null, alpha: number): string {
  if (!color) {
    return `rgba(${DEFAULT_ROUTE_RGB[0]}, ${DEFAULT_ROUTE_RGB[1]}, ${DEFAULT_ROUTE_RGB[2]}, ${alpha})`;
  }

  const trimmed = color.trim();

  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    const [, hex] = /^#([0-9a-fA-F]{3})$/.exec(trimmed) ?? [];

    if (hex) {
      const [r, g, b] = hex.split("").map((channel) => Number.parseInt(channel + channel, 16));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) {
    const [, hex] = /^#([0-9a-fA-F]{6})$/.exec(trimmed) ?? [];

    if (hex) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return `rgba(${DEFAULT_ROUTE_RGB[0]}, ${DEFAULT_ROUTE_RGB[1]}, ${DEFAULT_ROUTE_RGB[2]}, ${alpha})`;
}

function getStatusOpacity(status: MapObjectStatus): number {
  if (status === "draft") {
    return 0.55;
  }

  if (status === "archived") {
    return 0.4;
  }

  return 0.95;
}

function getStrokeSpec(
  strokeStyle: MapRouteStrokeStyle,
): { lineDash: number[] | undefined; lineCap: CanvasLineCap } {
  if (strokeStyle === "dashed") {
    return { lineDash: [12, 8], lineCap: "butt" };
  }

  if (strokeStyle === "dotted") {
    return { lineDash: [2, 8], lineCap: "round" };
  }

  return { lineDash: undefined, lineCap: "round" };
}

function getRouteWidthScale(resolution: number | undefined): number {
  if (!Number.isFinite(resolution) || typeof resolution !== "number") {
    return 1;
  }

  if (resolution <= 8) {
    return 1;
  }

  if (resolution >= 32) {
    return 0.55;
  }

  const progress = (resolution - 8) / 24;

  return 1 - progress * 0.45;
}

export function buildEditorRouteDisplayCoordinates(
  points: EditorMapRoutePoint[],
  geometryMode: EditorMapRoute["geometry_mode"],
): EditorMapRoutePoint[] {
  if (geometryMode !== "curved") {
    return points;
  }

  if (points.length < 3) {
    return points;
  }

  const coordinates: EditorMapRoutePoint[] = [];
  const segmentsPerInterval = 12;

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
        ((2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        ((2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      coordinates.push([x, y]);
    }
  }

  coordinates.push(points[points.length - 1]);
  return coordinates;
}

function createRouteFeature(route: EditorMapRoute): Feature<LineString> {
  const displayPoints = buildEditorRouteDisplayCoordinates(route.points, route.geometry_mode);
  const feature = new Feature<LineString>({
    geometry: new LineString(displayPoints),
    route,
  });

  feature.setId(`route:${route.id_route}`);
  return feature;
}

function getCachedRouteStyles(route: EditorMapRoute, resolution?: number): Style[] {
  const baseWidth =
    Number.isInteger(route.stroke_width) && route.stroke_width >= 1 && route.stroke_width <= 12
      ? route.stroke_width
      : 3;
  const widthScale = getRouteWidthScale(resolution);
  const normalizedWidth = Math.max(1, Math.round(baseWidth * widthScale * 10) / 10);
  const key = [
    route.status,
    route.stroke_style,
    normalizedWidth,
    route.stroke_color ?? "",
  ].join(":");
  const cached = routeStyleCache.get(key);

  if (cached) {
    return cached;
  }

  const opacity = getStatusOpacity(route.status);
  const { lineDash, lineCap } = getStrokeSpec(route.stroke_style);
  const haloColor = route.status === "archived" ? "rgba(18, 18, 18, 0.25)" : "rgba(18, 18, 18, 0.45)";
  const styles = [
    new Style({
      stroke: new Stroke({
        color: haloColor,
        width: normalizedWidth + 2,
        lineDash,
        lineCap,
        lineJoin: "round",
      }),
    }),
    new Style({
      stroke: new Stroke({
        color: route.status === "archived" ? "rgba(155, 155, 155, 0.55)" : toRgba(route.stroke_color, opacity),
        width: normalizedWidth,
        lineDash,
        lineCap,
        lineJoin: "round",
      }),
    }),
  ];

  routeStyleCache.set(key, styles);
  return styles;
}

export function createEditorRoutesVectorSource(): VectorSource {
  return new VectorSource();
}

export function createEditorRoutePreviewVectorSource(): VectorSource {
  return new VectorSource();
}

export function createEditorRoutesVectorLayer(
  source: VectorSource,
  options: { visible?: boolean } = {},
): VectorLayer {
  return new VectorLayer({
    source,
    visible: options.visible ?? true,
    style: (candidateFeature, resolution) => {
      if (!(candidateFeature instanceof Feature)) {
        return undefined;
      }

      const route = getEditorRouteFromFeature(candidateFeature as Feature<Geometry>);

      return route ? getCachedRouteStyles(route, resolution) : undefined;
    },
  });
}

export function createEditorRoutePreviewVectorLayer(
  source: VectorSource,
  options: { visible?: boolean } = {},
): VectorLayer {
  return new VectorLayer({
    source,
    visible: options.visible ?? true,
    style: (candidateFeature, resolution) => {
      if (!(candidateFeature instanceof Feature)) {
        return undefined;
      }

      const previewKind = candidateFeature.get("preview_kind");

      if (previewKind === "route-point") {
        return candidateFeature.get("preview_last_point") ? routePreviewLastPointStyle : routePreviewPointStyle;
      }

      const previewRoute = candidateFeature.get("route_preview") as EditorRoutePreview | undefined;

      if (!previewRoute) {
        return undefined;
      }

      return getCachedRouteStyles({
        id_route: "__preview__",
        faction: null,
        controleur: null,
        description: null,
        created_at: "",
        updated_at: "",
        ...previewRoute,
        status: previewRoute.status ?? "draft",
      }, resolution);
    },
  });
}

export function replaceEditorRouteFeatures(
  source: VectorSource,
  routes: EditorMapRoute[],
): void {
  source.clear(true);
  source.addFeatures(routes.map(createRouteFeature));
}

export function upsertEditorRouteFeature(
  source: VectorSource,
  route: EditorMapRoute,
): void {
  const featureId = `route:${route.id_route}`;
  const existing = source.getFeatureById(featureId);
  const nextFeature = createRouteFeature(route);

  if (existing) {
    source.removeFeature(existing);
  }

  source.addFeature(nextFeature);
}

export function replaceEditorRoutePreviewFeatures(
  source: VectorSource,
  route: EditorRoutePreview,
): void {
  source.clear(true);

  if (route.points.length === 0) {
    return;
  }

  if (route.points.length >= 2) {
    const lineFeature = new Feature<LineString>({
      geometry: new LineString(
        buildEditorRouteDisplayCoordinates(route.points, route.geometry_mode),
      ),
      route_preview: route,
      preview_kind: "route-line",
    });
    lineFeature.setId("route-preview:line");
    source.addFeature(lineFeature);
  }

  route.points.forEach((point, index) => {
    const pointFeature = new Feature({
      geometry: new Point(point),
      preview_kind: "route-point",
      preview_last_point: index === route.points.length - 1,
    });
    pointFeature.setId(`route-preview:point:${index}`);
    source.addFeature(pointFeature);
  });
}

export function clearEditorRoutePreview(source: VectorSource): void {
  source.clear(true);
}

export function syncEditorRoutesLayerVisibility(
  layer: VectorLayer | null,
  visible: boolean,
): void {
  if (!layer) {
    return;
  }

  layer.setVisible(visible);
  layer.changed();
}

export function getEditorRouteFromFeature(
  feature: Feature<Geometry>,
): EditorMapRoute | null {
  const route = feature.get("route");
  return isEditorMapRoute(route) ? route : null;
}
