import { NextResponse } from "next/server";

import { getPublicCaseIndexResponse } from "@/server/public-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await getPublicCaseIndexResponse();

    return NextResponse.json(records, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Lecture publique impossible.",
      },
      { status: 500 },
    );
  }
}
