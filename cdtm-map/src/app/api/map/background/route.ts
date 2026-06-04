import { NextResponse } from "next/server";

import { createDefaultMapBackgroundManifest } from "@/map/background";
import { getPublicMapBackgroundManifest } from "@/server/map-background-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const manifest = await getPublicMapBackgroundManifest();

    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Lecture du fond de carte impossible.", error);

    return NextResponse.json(createDefaultMapBackgroundManifest("tiles"), {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  }
}
