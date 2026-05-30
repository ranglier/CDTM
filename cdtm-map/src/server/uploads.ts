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

type MapIconUploadResult = {
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

function assertExpectedExtension(filename: string, mimeType: string): void {
  const expectedExtension = ALLOWED_MAP_ICON_MIME_TYPES.get(mimeType);
  const extension = path.extname(filename).toLowerCase();

  if (!expectedExtension || extension !== expectedExtension) {
    throw new Error("Extension de fichier invalide.");
  }
}

function assertPngSignature(buffer: Buffer): void {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (buffer.byteLength < pngSignature.byteLength || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Signature PNG invalide.");
  }
}

function assertWebpSignature(buffer: Buffer): void {
  if (
    buffer.byteLength < 12 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error("Signature WebP invalide.");
  }
}

function validateSvgContent(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "");
  const trimmed = normalized.trim();

  if (!trimmed || !/<svg[\s>]/i.test(trimmed)) {
    throw new Error("SVG invalide : balise <svg> manquante.");
  }

  if (/\0/.test(trimmed)) {
    throw new Error("SVG invalide : contenu binaire detecte.");
  }

  const blockedPatterns: Array<[RegExp, string]> = [
    [/<script[\s>]/i, "SVG refuse pour raison de securite."],
    [/<foreignobject[\s>]/i, "SVG refuse pour raison de securite."],
    [/<iframe[\s>]/i, "SVG refuse pour raison de securite."],
    [/<object[\s>]/i, "SVG refuse pour raison de securite."],
    [/<embed[\s>]/i, "SVG refuse pour raison de securite."],
    [/<audio[\s>]/i, "SVG refuse pour raison de securite."],
    [/<video[\s>]/i, "SVG refuse pour raison de securite."],
    [/<canvas[\s>]/i, "SVG refuse pour raison de securite."],
    [/<link[\s>]/i, "SVG refuse pour raison de securite."],
    [/<!doctype/i, "SVG refuse pour raison de securite."],
    [/<!entity/i, "SVG refuse pour raison de securite."],
    [/on[a-z]+\s*=/i, "SVG refuse pour raison de securite."],
    [/javascript\s*:/i, "SVG refuse pour raison de securite."],
    [/xlink:href\s*=\s*["']\s*https?:/i, "SVG refuse pour raison de securite."],
    [/\shref\s*=\s*["']\s*https?:/i, "SVG refuse pour raison de securite."],
    [/xlink:href\s*=\s*["']\s*data:/i, "SVG refuse pour raison de securite."],
    [/\shref\s*=\s*["']\s*data:/i, "SVG refuse pour raison de securite."],
    [/<style[\s>][\s\S]*(@import|url\s*\()/i, "SVG refuse pour raison de securite."],
  ];

  for (const [pattern, message] of blockedPatterns) {
    if (pattern.test(trimmed)) {
      throw new Error(message);
    }
  }

  return trimmed;
}

function getUploadsDir(): string {
  return getServerEnv().uploadsDir;
}

function getMapIconUploadsDir(): string {
  return path.join(getUploadsDir(), MAP_ICON_UPLOAD_SUBDIR);
}

export async function ensureMapIconUploadsDir(): Promise<string> {
  const directory = getMapIconUploadsDir();
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function saveMapIconUpload(file: File): Promise<MapIconUploadResult> {
  const mimeType = assertAllowedMimeType(file.type);
  assertExpectedExtension(file.name, mimeType);

  if (file.size <= 0 || file.size > MAX_MAP_ICON_SIZE_BYTES) {
    throw new Error("Taille d'image invalide.");
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  let buffer = sourceBuffer;

  if (mimeType === "image/svg+xml") {
    buffer = Buffer.from(validateSvgContent(sourceBuffer.toString("utf8")), "utf8");
  } else if (mimeType === "image/png") {
    assertPngSignature(sourceBuffer);
  } else if (mimeType === "image/webp") {
    assertWebpSignature(sourceBuffer);
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
