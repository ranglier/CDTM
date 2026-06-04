import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

import sharp from "sharp";

const SAMPLE_LIMIT = Number.parseInt(
  process.env.CASE_TILE_BENCHMARK_LIMIT ?? "64",
  10,
);

async function listWebpFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listWebpFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".webp")
        ? [entryPath]
        : [];
    }),
  );

  return files.flat();
}

async function benchmarkVariant(label, files, encode) {
  const start = performance.now();
  let totalBytes = 0;

  for (const file of files) {
    const buffer = await encode(file);
    totalBytes += buffer.byteLength;
  }

  return {
    label,
    files: files.length,
    totalBytes,
    avgBytes: Math.round(totalBytes / files.length),
    totalMs: Math.round((performance.now() - start) * 10) / 10,
  };
}

const sampleRoot = process.argv[2] ?? process.env.CASE_TILE_SAMPLE_DIR;

if (!sampleRoot) {
  console.error(
    "Usage: npm run benchmark:case-tiles -- /app/uploads/map-case-tiles/<id>/tiles/faction",
  );
  process.exit(1);
}

const files = (await listWebpFiles(sampleRoot))
  .sort((left, right) => left.localeCompare(right))
  .slice(0, Number.isFinite(SAMPLE_LIMIT) ? SAMPLE_LIMIT : 64);

if (files.length === 0) {
  console.error(`Aucune tuile .webp trouvee dans ${sampleRoot}`);
  process.exit(1);
}

const rows = await Promise.all([
  benchmarkVariant("webp-lossless", files, (file) =>
    sharp(file).webp({ lossless: true }).toBuffer(),
  ),
  benchmarkVariant("webp-lossy-alpha", files, (file) =>
    sharp(file).webp({ quality: 85, alphaQuality: 90 }).toBuffer(),
  ),
  benchmarkVariant("png-optimized", files, (file) =>
    sharp(file).png({ compressionLevel: 9, palette: true }).toBuffer(),
  ),
]);

console.table(rows);
