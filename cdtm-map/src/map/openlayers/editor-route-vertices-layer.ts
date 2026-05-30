import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import type Geometry from "ol/geom/Geometry";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

type EditorRouteVertex = {
  routeId: string;
  vertexIndex: number;
};

const defaultVertexStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 244, 194, 0.96)" }),
    stroke: new Stroke({ color: "rgba(18, 18, 18, 0.95)", width: 2 }),
  }),
});

const selectedVertexStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: "rgba(255, 255, 255, 1)" }),
    stroke: new Stroke({ color: "rgba(0, 180, 255, 0.95)", width: 3 }),
  }),
});

function isEditorRouteVertex(value: unknown): value is EditorRouteVertex {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.routeId === "string" &&
    Number.isInteger(candidate.vertexIndex)
  );
}

function createRouteVertexFeature(
  routeId: string,
  coordinate: [number, number],
  vertexIndex: number,
  selectedIndex: number | null,
): Feature<Point> {
  const feature = new Feature<Point>({
    geometry: new Point(coordinate),
    routeVertex: {
      routeId,
      vertexIndex,
    } satisfies EditorRouteVertex,
    selected: selectedIndex === vertexIndex,
  });

  feature.setId(`route-vertex:${routeId}:${vertexIndex}`);
  return feature;
}

export function createEditorRouteVerticesVectorSource(): VectorSource {
  return new VectorSource();
}

export function createEditorRouteVerticesVectorLayer(
  source: VectorSource,
  options: { visible?: boolean } = {},
): VectorLayer {
  return new VectorLayer({
    source,
    visible: options.visible ?? false,
    style: (candidateFeature) => {
      if (!(candidateFeature instanceof Feature)) {
        return undefined;
      }

      return candidateFeature.get("selected") ? selectedVertexStyle : defaultVertexStyle;
    },
  });
}

export function replaceEditorRouteVertexFeatures(
  source: VectorSource | null,
  routeId: string,
  points: Array<[number, number]>,
  selectedIndex: number | null,
): void {
  if (!source) {
    return;
  }

  source.clear(true);
  source.addFeatures(
    points.map((point, index) =>
      createRouteVertexFeature(routeId, point, index, selectedIndex),
    ),
  );
}

export function clearEditorRouteVertexFeatures(source: VectorSource | null): void {
  source?.clear(true);
}

export function getEditorRouteVertexFromFeature(
  feature: Feature<Geometry>,
): EditorRouteVertex | null {
  const routeVertex = feature.get("routeVertex");

  return isEditorRouteVertex(routeVertex) ? routeVertex : null;
}
