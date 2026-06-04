import {
  resolveCaseIdFromPickingColor,
  type MapCasePickingManifest,
} from "./case-tiles.ts";

type CasePickingTileRequest = {
  z: number;
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
};

type CasePickingReaderOptions = {
  picking: MapCasePickingManifest;
  extent: [number, number, number, number];
  tileSize: number;
  minZoom: number;
  maxZoom: number;
  resolutions: number[];
};

type LoadedPickingTile = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

export type CasePickingReader = {
  pickCaseId: (coordinate: [number, number]) => Promise<string | null>;
  clear: () => void;
};

function formatTileUrl(
  tileUrlTemplate: string,
  z: number,
  x: number,
  y: number,
): string {
  return tileUrlTemplate
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

export function getCasePickingTileRequest({
  coordinate,
  extent,
  tileSize,
  minZoom,
  maxZoom,
  resolutions,
}: {
  coordinate: [number, number];
  extent: [number, number, number, number];
  tileSize: number;
  minZoom: number;
  maxZoom: number;
  resolutions: number[];
}): CasePickingTileRequest | null {
  const [x, y] = coordinate;

  if (x < extent[0] || x > extent[2] || y < extent[1] || y > extent[3]) {
    return null;
  }

  const z = maxZoom;
  const resolution = resolutions[z - minZoom];

  if (!Number.isFinite(resolution) || resolution <= 0) {
    return null;
  }

  const worldTileSize = tileSize * resolution;
  const tileX = Math.floor((x - extent[0]) / worldTileSize);
  const tileY = Math.floor((extent[3] - y) / worldTileSize);
  const pixelX = Math.floor((x - extent[0]) / resolution - tileX * tileSize);
  const pixelY = Math.floor((extent[3] - y) / resolution - tileY * tileSize);

  if (
    tileX < 0 ||
    tileY < 0 ||
    pixelX < 0 ||
    pixelY < 0 ||
    pixelX >= tileSize ||
    pixelY >= tileSize
  ) {
    return null;
  }

  return {
    z,
    x: tileX,
    y: tileY,
    pixelX,
    pixelY,
  };
}

function createEmptyTileCanvas(tileSize: number): LoadedPickingTile | null {
  const canvas = document.createElement("canvas");
  canvas.width = tileSize;
  canvas.height = tileSize;
  const context = canvas.getContext("2d");

  return context ? { canvas, context } : null;
}

function loadPickingTile(
  url: string,
  tileSize: number,
): Promise<LoadedPickingTile | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => {
      const tile = createEmptyTileCanvas(tileSize);

      if (!tile) {
        resolve(null);
        return;
      }

      tile.context.drawImage(image, 0, 0, tileSize, tileSize);
      resolve(tile);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function getSampleOffsets(radius: number): Array<[number, number]> {
  const offsets: Array<[number, number]> = [[0, 0]];

  for (let distance = 1; distance <= radius; distance += 1) {
    for (let y = -distance; y <= distance; y += 1) {
      for (let x = -distance; x <= distance; x += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) === distance) {
          offsets.push([x, y]);
        }
      }
    }
  }

  return offsets;
}

const EDGE_SAMPLE_OFFSETS = getSampleOffsets(2);

export function readCaseIdFromPickingTile({
  tile,
  pixelX,
  pixelY,
  tileSize,
  idByValue,
}: {
  tile: LoadedPickingTile;
  pixelX: number;
  pixelY: number;
  tileSize: number;
  idByValue: string[];
}): string | null {
  for (const [offsetX, offsetY] of EDGE_SAMPLE_OFFSETS) {
    const x = pixelX + offsetX;
    const y = pixelY + offsetY;

    if (x < 0 || y < 0 || x >= tileSize || y >= tileSize) {
      continue;
    }

    const data = tile.context.getImageData(x, y, 1, 1).data;
    const idCase = resolveCaseIdFromPickingColor(
      {
        r: data[0],
        g: data[1],
        b: data[2],
        alpha: data[3],
      },
      idByValue,
    );

    if (idCase) {
      return idCase;
    }
  }

  return null;
}

export function createCasePickingReader({
  picking,
  extent,
  tileSize,
  minZoom,
  maxZoom,
  resolutions,
}: CasePickingReaderOptions): CasePickingReader {
  const tileCache = new Map<string, Promise<LoadedPickingTile | null>>();

  return {
    async pickCaseId(coordinate) {
      const request = getCasePickingTileRequest({
        coordinate,
        extent,
        tileSize,
        minZoom,
        maxZoom,
        resolutions,
      });

      if (!request) {
        return null;
      }

      const cacheKey = `${request.z}/${request.x}/${request.y}`;
      let tilePromise = tileCache.get(cacheKey);

      if (!tilePromise) {
        tilePromise = loadPickingTile(
          formatTileUrl(
            picking.tileUrlTemplate,
            request.z,
            request.x,
            request.y,
          ),
          tileSize,
        );
        tileCache.set(cacheKey, tilePromise);
      }

      const tile = await tilePromise;

      return tile
        ? readCaseIdFromPickingTile({
            tile,
            pixelX: request.pixelX,
            pixelY: request.pixelY,
            tileSize,
            idByValue: picking.idByValue,
          })
        : null;
    },
    clear() {
      tileCache.clear();
    },
  };
}
