import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { getServerEnv } from "@/server/env";

const MAP_ICON_UPLOAD_SUBDIR = "map-icons";
const ALLOWED_MAP_ICON_MIME_TYPES = new Map([
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
]);
const MAX_MAP_ICON_SIZE_BYTES = 1024 * 1024;

export type MapIconUploadResult = {
  image_path: string;
  image_original_name: string;
  image_mime_type: string;
  image_size_bytes: number;
};

function assertSimpleFilename(filename: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) {
    throw new Error("Nom de fichier invalide.");
  }

  return filename;
}

function sanitizeOriginalName(value: string): string {
  const trimmed = value.trim();
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return sanitized.length > 0 ? sanitized : "map-icon";
}

function assertAllowedMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();

  if (!ALLOWED_MAP_ICON_MIME_TYPES.has(normalized)) {
    throw new Error("Type d'image non autorise.");
  }

  return normalized;
}

function validateSvgContent(content: string): void {
  const lower = content.toLowerCase();

  if (
    lower.includes("<script") ||
    /on[a-z]+\s*=/.test(lower) ||
    lower.includes("javascript:") ||
    lower.includes("<iframe") ||
    lower.includes("<object") ||
    lower.includes("<embed") ||
    /xlink:href\s*=\s*["']https?:/i.test(content) ||
    /href\s*=\s*["']https?:/i.test(content)
  ) {
    throw new Error("Fichier SVG refuse pour raison de securite.");
  }
}

export function getUploadsDir(): string {
  return getServerEnv().uploadsDir;
}

export function getMapIconUploadsDir(): string {
  return path.join(getUploadsDir(), MAP_ICON_UPLOAD_SUBDIR);
}

export async function ensureMapIconUploadsDir(): Promise<string> {
  const directory = getMapIconUploadsDir();
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function saveMapIconUpload(file: File): Promise<MapIconUploadResult> {
  const mimeType = assertAllowedMimeType(file.type);

  if (file.size <= 0 || file.size > MAX_MAP_ICON_SIZE_BYTES) {
    throw new Error("Taille d'image invalide.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (mimeType === "image/svg+xml") {
    validateSvgContent(buffer.toString("utf8"));
  }

  const extension = ALLOWED_MAP_ICON_MIME_TYPES.get(mimeType) ?? ".bin";
  const originalName = sanitizeOriginalName(file.name);
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const directory = await ensureMapIconUploadsDir();
  const absolutePath = path.join(directory, filename);

  await writeFile(absolutePath, buffer);

  return {
    image_path: `/uploads/map-icons/${filename}`,
    image_original_name: originalName,
    image_mime_type: mimeType,
    image_size_bytes: buffer.byteLength,
  };
}

export async function readMapIconUpload(filename: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const safeFilename = assertSimpleFilename(filename);
  const absolutePath = path.join(getMapIconUploadsDir(), safeFilename);
  const fileStat = await stat(absolutePath);

  if (!fileStat.isFile()) {
    throw new Error("Fichier introuvable.");
  }

  const extension = path.extname(safeFilename).toLowerCase();
  const mimeType =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : extension === ".svg"
          ? "image/svg+xml"
          : null;

  if (!mimeType) {
    throw new Error("Type de fichier non pris en charge.");
  }

  return {
    buffer: await readFile(absolutePath),
    mimeType,
  };
}
