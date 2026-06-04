#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_INTERACTION_TOLERANCE = 1;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(appDir, "public/data/cases.geojson");
const outputPath = path.join(appDir, "public/data/cases.interaction.geojson");

function squaredDistance(left, right) {
  const dx = left[0] - right[0];
  const dy = left[1] - right[1];

  return dx * dx + dy * dy;
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  const dx = end[0] - x;
  const dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  return squaredDistance(point, [x, y]);
}

function isPoint(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function isClosedRing(ring) {
  return (
    ring.length > 1 &&
    ring[0][0] === ring.at(-1)[0] &&
    ring[0][1] === ring.at(-1)[1]
  );
}

function closeRing(points) {
  if (points.length === 0) {
    return points;
  }

  const first = points[0];
  const last = points.at(-1);

  return last && first[0] === last[0] && first[1] === last[1]
    ? points
    : [...points, first];
}

function uniqueSequentialPoints(points) {
  const output = [];

  for (const point of points) {
    const previous = output.at(-1);

    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) {
      output.push(point);
    }
  }

  return output;
}

function simplifyRadialDistance(points, squaredTolerance) {
  if (points.length <= 2) {
    return points;
  }

  const output = [points[0]];
  let previous = points[0];

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];

    if (squaredDistance(point, previous) > squaredTolerance) {
      output.push(point);
      previous = point;
    }
  }

  if (previous !== points.at(-1)) {
    output.push(points.at(-1));
  }

  return output;
}

function simplifyDouglasPeucker(points, squaredTolerance) {
  const lastIndex = points.length - 1;

  if (points.length <= 2) {
    return points;
  }

  const markers = new Uint8Array(points.length);
  const stack = [[0, lastIndex]];
  markers[0] = 1;
  markers[lastIndex] = 1;

  while (stack.length > 0) {
    const [firstIndex, lastIndex] = stack.pop();
    let maxSquaredDistance = 0;
    let indexToKeep = 0;

    for (let index = firstIndex + 1; index < lastIndex; index += 1) {
      const distance = squaredSegmentDistance(
        points[index],
        points[firstIndex],
        points[lastIndex],
      );

      if (distance > maxSquaredDistance) {
        indexToKeep = index;
        maxSquaredDistance = distance;
      }
    }

    if (maxSquaredDistance > squaredTolerance) {
      markers[indexToKeep] = 1;
      stack.push([firstIndex, indexToKeep], [indexToKeep, lastIndex]);
    }
  }

  return points.filter((_point, index) => markers[index] === 1);
}

function fallbackTriangle(points) {
  return closeRing(uniqueSequentialPoints(points).slice(0, 3));
}

export function simplifyRing(ring, tolerance = DEFAULT_INTERACTION_TOLERANCE) {
  const cleanRing = uniqueSequentialPoints(ring.filter(isPoint));
  const openRing = isClosedRing(cleanRing) ? cleanRing.slice(0, -1) : cleanRing;

  if (openRing.length <= 3) {
    return closeRing(openRing);
  }

  const squaredTolerance = tolerance * tolerance;
  const simplified = simplifyDouglasPeucker(
    simplifyRadialDistance(openRing, squaredTolerance),
    squaredTolerance,
  );
  const safeRing = simplified.length >= 3 ? simplified : fallbackTriangle(openRing);

  return closeRing(safeRing);
}

function simplifyPolygon(polygon, tolerance) {
  return polygon
    .map((ring) => simplifyRing(ring, tolerance))
    .filter((ring, index) => index === 0 || ring.length >= 4);
}

export function simplifyGeometry(geometry, tolerance = DEFAULT_INTERACTION_TOLERANCE) {
  if (!geometry || typeof geometry !== "object") {
    throw new Error("Geometrie de case invalide.");
  }

  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: simplifyPolygon(geometry.coordinates, tolerance),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) =>
        simplifyPolygon(polygon, tolerance),
      ),
    };
  }

  throw new Error(`Type de geometrie non supporte: ${geometry.type}`);
}

function getFeatureId(feature) {
  const idCase = feature?.properties?.id_case;

  if (typeof idCase !== "string" || idCase.trim().length === 0) {
    throw new Error("Case sans id_case.");
  }

  return idCase;
}

export function createInteractionFeature(feature, tolerance = DEFAULT_INTERACTION_TOLERANCE) {
  const idCase = getFeatureId(feature);
  const registryId =
    typeof feature.properties.registry_id_case === "string" &&
    feature.properties.registry_id_case.trim().length > 0
      ? feature.properties.registry_id_case
      : idCase;

  return {
    type: "Feature",
    properties: {
      id_case: idCase,
      registry_id_case: registryId,
    },
    geometry: simplifyGeometry(feature.geometry, tolerance),
  };
}

export function createInteractionFeatureCollection(
  collection,
  tolerance = DEFAULT_INTERACTION_TOLERANCE,
) {
  if (
    !collection ||
    typeof collection !== "object" ||
    collection.type !== "FeatureCollection" ||
    !Array.isArray(collection.features)
  ) {
    throw new Error("GeoJSON des cases invalide.");
  }

  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) =>
      createInteractionFeature(feature, tolerance),
    ),
  };
}

export function countCoordinates(value) {
  if (!Array.isArray(value)) {
    return 0;
  }

  if (isPoint(value)) {
    return 1;
  }

  return value.reduce((sum, item) => sum + countCoordinates(item), 0);
}

async function main() {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const output = createInteractionFeatureCollection(source);
  const serialized = `${JSON.stringify(output)}\n`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");

  const sourceCoordinateCount = countCoordinates(
    source.features.flatMap((feature) => feature.geometry.coordinates),
  );
  const outputCoordinateCount = countCoordinates(
    output.features.flatMap((feature) => feature.geometry.coordinates),
  );

  console.log(
    [
      `Generated ${output.features.length} interaction case feature(s)`,
      `coordinates ${sourceCoordinateCount} -> ${outputCoordinateCount}`,
      `output ${path.relative(appDir, outputPath)}`,
      `bytes ${Buffer.byteLength(serialized)}`,
    ].join(" | "),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
