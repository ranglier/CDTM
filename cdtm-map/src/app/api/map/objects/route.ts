import { NextResponse } from "next/server";

import { getPublicMapObjectsResponse } from "@/server/public-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const objects = await getPublicMapObjectsResponse();

    return NextResponse.json(objects, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Lecture publique des objets impossible.",
      },
      { status: 500 },
    );
  }
}
