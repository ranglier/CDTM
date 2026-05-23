import { NextResponse } from "next/server";

import { getPublicCaseIndex } from "@/server/admin-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await getPublicCaseIndex();

    return NextResponse.json(records, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture publique impossible.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
