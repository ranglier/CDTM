import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

function toHexBuffer(value: string): Buffer {
  return Buffer.from(value, "hex");
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(secret, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifySecret(secret: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const expectedKey = toHexBuffer(hash);
  const derivedKey = (await scrypt(secret, salt, expectedKey.length)) as Buffer;

  return (
    expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey)
  );
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
