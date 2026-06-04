import { NextResponse } from "next/server";

import { getPublicMapObjectsResponse } from "@/server/public-repository";
import {
  PUBLIC_DATA_CACHE_CONTROL,
  createPublicJsonResponse,
} from "@/server/public-cache";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const objects = await getPublicMapObjectsResponse();

    return createPublicJsonResponse(request, objects, PUBLIC_DATA_CACHE_CONTROL);
  } catch {
    return NextResponse.json(
      {
        error: "Lecture publique des objets impossible.",
      },
      { status: 500 },
    );
  }
}
