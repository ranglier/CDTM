import { NextResponse } from "next/server";

import { getPublicCaseIndexResponse } from "@/server/public-repository";
import {
  PUBLIC_DATA_CACHE_CONTROL,
  createPublicJsonResponse,
} from "@/server/public-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const records = await getPublicCaseIndexResponse();

    return createPublicJsonResponse(request, records, PUBLIC_DATA_CACHE_CONTROL);
  } catch {
    return NextResponse.json(
      {
        error: "Lecture publique impossible.",
      },
      { status: 500 },
    );
  }
}
