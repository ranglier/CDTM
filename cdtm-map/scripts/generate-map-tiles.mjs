import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const MAP_BACKGROUND_WIDTH = 3200;
const MAP_BACKGROUND_HEIGHT = 4000;
const TILE_SIZE = 256;
const WEBP_QUALITY = 85;
const RESOLUTIONS = [16, 8, 4, 2, 1];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(appDir, "public/maps/CTM.png");
const outputDir = path.join(appDir, "public/maps/tiles/ctm");

function getTilePlan() {
  return RESOLUTIONS.map((resolution, z) => {
    const width = Math.ceil(MAP_BACKGROUND_WIDTH / resolution);
    const height = Math.ceil(MAP_BACKGROUND_HEIGHT / resolution);
    const columns = Math.ceil(width / TILE_SIZE);
    const rows = Math.ceil(height / TILE_SIZE);

    return {
      z,
      resolution,
      width,
      height,
      columns,
      rows,
      tileCount: columns * rows,
    };
  });
}

async function assertSourceImage() {
  const sourceStat = await stat(sourcePath);

  if (!sourceStat.isFile()) {
    throw new Error(`Source introuvable: ${sourcePath}`);
  }

  const metadata = await sharp(sourcePath, { animated: true }).metadata();

  if (
    metadata.width !== MAP_BACKGROUND_WIDTH ||
    metadata.height !== MAP_BACKGROUND_HEIGHT
  ) {
    throw new Error(
      `Dimensions incompatibles: ${metadata.width} x ${metadata.height}`,
    );
  }

  if (typeof metadata.pages === "number" && metadata.pages > 1) {
    throw new Error("Les images animees ne sont pas autorisees.");
  }
}

async function prepareLevelImage(level) {
  const { data, info } = await sharp(sourcePath, { animated: false })
    .ensureAlpha()
    .resize({
      width: level.width,
      height: level.height,
      fit: "fill",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

async function writeTile({ levelImage, level, column, row, targetPath }) {
  const left = column * TILE_SIZE;
  const top = row * TILE_SIZE;
  const width = Math.min(TILE_SIZE, level.width - left);
  const height = Math.min(TILE_SIZE, level.height - top);

  let pipeline = sharp(levelImage.data, {
    raw: {
      width: levelImage.width,
      height: levelImage.height,
      channels: levelImage.channels,
    },
  }).extract({ left, top, width, height });

  if (width < TILE_SIZE || height < TILE_SIZE) {
    pipeline = pipeline.extend({
      right: TILE_SIZE - width,
      bottom: TILE_SIZE - height,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await pipeline.webp({ quality: WEBP_QUALITY }).toFile(targetPath);
}

async function main() {
  await assertSourceImage();

  const tmpDir = `${outputDir}.tmp`;
  let tileCount = 0;

  await rm(tmpDir, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  for (const level of getTilePlan()) {
    const levelImage = await prepareLevelImage(level);

    for (let row = 0; row < level.rows; row += 1) {
      for (let column = 0; column < level.columns; column += 1) {
        await writeTile({
          levelImage,
          level,
          column,
          row,
          targetPath: path.join(
            tmpDir,
            String(level.z),
            String(column),
            `${row}.webp`,
          ),
        });
        tileCount += 1;
      }
    }
  }

  await rename(tmpDir, outputDir);
  console.log(`Generated ${tileCount} map tile(s) in ${outputDir}`);
}

await main();
