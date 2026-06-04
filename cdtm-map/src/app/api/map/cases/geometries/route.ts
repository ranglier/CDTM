import { NextRequest, NextResponse } from "next/server";

import { loadStableCaseFeatureCollection } from "@/server/stable-case-source";

export const runtime = "nodejs";

const MAX_CASE_GEOMETRY_IDS = 1500;

function normalizeRequestedIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((idCase): idCase is string => typeof idCase === "string")
        .map((idCase) => idCase.trim())
        .filter((idCase) => /^[a-zA-Z0-9_-]+$/.test(idCase)),
    ),
  ).slice(0, MAX_CASE_GEOMETRY_IDS);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: unknown };
    const ids = normalizeRequestedIds(body.ids);

    if (ids.length === 0) {
      return NextResponse.json(
        { type: "FeatureCollection", features: [] },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }

    const requestedIds = new Set(ids);
    const collection = await loadStableCaseFeatureCollection();
    const features = collection.features.filter((feature) =>
      requestedIds.has(feature.properties.id_case),
    );

    return NextResponse.json(
      {
        type: "FeatureCollection",
        features,
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Lecture des geometries de cases impossible.", error);
    return NextResponse.json(
      { error: "Lecture des geometries de cases impossible." },
      { status: 500 },
    );
  }
}
