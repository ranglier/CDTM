import { NextRequest, NextResponse } from "next/server";

import { isMapCompositeTileProfile } from "@/map/composite-tiles";
import { requireTechAdminUser } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { regenerateMapCompositeTiles } from "@/server/map-composite-tile-repository";

export const runtime = "nodejs";

function createUnauthorizedResponse() {
  return NextResponse.json(
    {
      error: "Acces admin non autorise.",
    },
    { status: 401 },
  );
}

function createForbiddenResponse() {
  return NextResponse.json(
    {
      error: "Cette page est reservee aux administrateurs techniques.",
    },
    { status: 403 },
  );
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_URL manquante. L'admin n'est pas disponible.",
      },
      { status: 503 },
    );
  }

  let userId: number;

  try {
    userId = (await requireTechAdminUser(request)).userId;
  } catch (error) {
    if (error instanceof Error && error.message === "TECH_ADMIN_REQUIRED") {
      return createForbiddenResponse();
    }

    return createUnauthorizedResponse();
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      profile?: unknown;
    };

    if (!isMapCompositeTileProfile(body.profile)) {
      return NextResponse.json(
        { error: "Profil de tuiles composees invalide." },
        { status: 400 },
      );
    }

    const status = await regenerateMapCompositeTiles({
      profile: body.profile,
      userId,
    });

    return NextResponse.json(status, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Generation des tuiles composees impossible.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
