import { createHash } from "node:crypto";

export const PUBLIC_MANIFEST_CACHE_CONTROL =
  "public, max-age=30, stale-while-revalidate=300";
export const PUBLIC_DATA_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=3600";

export function createPublicJsonEtag(value: unknown): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("base64url");

  return `"sha256-${digest.slice(0, 32)}"`;
}

export function isRequestEtagMatch(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatch) {
    return false;
  }

  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === "*" || candidate === etag);
}

export function createPublicJsonResponse(
  request: Request,
  value: unknown,
  cacheControl: string,
): Response {
  const etag = createPublicJsonEtag(value);
  const headers = {
    "cache-control": cacheControl,
    etag,
  };

  if (isRequestEtagMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, {
      status: 304,
      headers,
    });
  }

  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      ...headers,
      "content-type": "application/json",
    },
  });
}
