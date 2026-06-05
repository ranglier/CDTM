import {
  createLegacyMapCompositeTileManifest,
  isMapCompositeTileProfile,
  type MapCompositeTileProfile,
} from "@/map/composite-tiles";
import { getPublicMapCompositeTileManifest } from "@/server/map-composite-tile-repository";
import {
  PUBLIC_MANIFEST_CACHE_CONTROL,
  createPublicJsonResponse,
} from "@/server/public-cache";

export const runtime = "nodejs";

function getProfileFromRequest(request: Request): MapCompositeTileProfile {
  const url = new URL(request.url);
  const profile = url.searchParams.get("profile");

  return isMapCompositeTileProfile(profile) ? profile : "mobile";
}

export async function GET(request: Request) {
  const profile = getProfileFromRequest(request);

  try {
    const manifest = await getPublicMapCompositeTileManifest(profile);

    return createPublicJsonResponse(
      request,
      manifest,
      PUBLIC_MANIFEST_CACHE_CONTROL,
    );
  } catch (error) {
    console.error("Lecture des tuiles composees impossible.", error);

    return createPublicJsonResponse(
      request,
      createLegacyMapCompositeTileManifest(profile),
      PUBLIC_MANIFEST_CACHE_CONTROL,
    );
  }
}
