import { createVectorFallbackMapCaseTileManifest } from "@/map/case-tiles";
import { getPublicMapCaseTileManifest } from "@/server/map-case-tile-repository";
import {
  PUBLIC_CASE_TILE_MANIFEST_CACHE_CONTROL,
  createPublicJsonResponse,
} from "@/server/public-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const manifest = await getPublicMapCaseTileManifest();

    return createPublicJsonResponse(
      request,
      manifest,
      PUBLIC_CASE_TILE_MANIFEST_CACHE_CONTROL,
    );
  } catch (error) {
    console.error("Lecture des tuiles de cases impossible.", error);

    return createPublicJsonResponse(
      request,
      createVectorFallbackMapCaseTileManifest(),
      PUBLIC_CASE_TILE_MANIFEST_CACHE_CONTROL,
    );
  }
}
