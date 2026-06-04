import { NextRequest, NextResponse } from "next/server";

import { readMapCaseTileUpload } from "@/server/map-case-tiling";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
      mode: string;
      z: string;
      x: string;
      filename: string;
    }>;
  },
) {
  try {
    const params = await context.params;
    const tile = await readMapCaseTileUpload({
      idTileSet: params.id,
      mode: params.mode,
      z: params.z,
      x: params.x,
      filename: params.filename,
    });

    return new NextResponse(new Uint8Array(tile), {
      status: 200,
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": "image/webp",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
