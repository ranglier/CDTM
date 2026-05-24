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

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "content-type": file.mimeType,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
