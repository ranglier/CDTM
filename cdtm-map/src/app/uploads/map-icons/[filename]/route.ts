import { NextRequest, NextResponse } from "next/server";

import { readMapIconUpload } from "@/server/uploads";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    const params = await context.params;
    const file = await readMapIconUpload(params.filename);

    const headers: Record<string, string> = {
      "cache-control": "public, max-age=3600",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    };

    if (file.mimeType === "image/svg+xml") {
      headers["content-type"] = "image/svg+xml; charset=utf-8";
      headers["content-security-policy"] =
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox;";
    } else {
      headers["content-type"] = file.mimeType;
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers,
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
