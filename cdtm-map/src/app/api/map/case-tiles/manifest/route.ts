import { NextResponse } from "next/server";

import { createVectorFallbackMapCaseTileManifest } from "@/map/case-tiles";
import { getPublicMapCaseTileManifest } from "@/server/map-case-tile-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const manifest = await getPublicMapCaseTileManifest();

    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Lecture des tuiles de cases impossible.", error);

    return NextResponse.json(createVectorFallbackMapCaseTileManifest(), {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  }
}
