import { NextRequest, NextResponse } from "next/server";

import { requireTechAdminUser } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { deleteMapCaseTileSet } from "@/server/map-case-tile-repository";

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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_URL manquante. L'admin n'est pas disponible.",
      },
      { status: 503 },
    );
  }

  try {
    await requireTechAdminUser(request);
  } catch (error) {
    if (error instanceof Error && error.message === "TECH_ADMIN_REQUIRED") {
      return createForbiddenResponse();
    }

    return createUnauthorizedResponse();
  }

  try {
    const params = await context.params;
    const status = await deleteMapCaseTileSet(params.id);

    return NextResponse.json(status, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suppression impossible.";
    const status = message.includes("introuvable")
      ? 404
      : message.includes("actif") || message.includes("en cours")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
