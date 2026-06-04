import { createDefaultMapBackgroundManifest } from "@/map/background";
import { getPublicMapBackgroundManifest } from "@/server/map-background-repository";
import {
  PUBLIC_MANIFEST_CACHE_CONTROL,
  createPublicJsonResponse,
} from "@/server/public-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const manifest = await getPublicMapBackgroundManifest();

    return createPublicJsonResponse(
      request,
      manifest,
      PUBLIC_MANIFEST_CACHE_CONTROL,
    );
  } catch (error) {
    console.error("Lecture du fond de carte impossible.", error);

    return createPublicJsonResponse(
      request,
      createDefaultMapBackgroundManifest("tiles"),
      PUBLIC_MANIFEST_CACHE_CONTROL,
    );
  }
}
