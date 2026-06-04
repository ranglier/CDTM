import { NextRequest, NextResponse } from "next/server";

import { requireTechAdminUser } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import {
  activateMapBackground,
  deleteMapBackground,
} from "@/server/map-background-repository";

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

export async function PATCH(
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
    const params = await context.params;
    const background = await activateMapBackground(params.id, userId);

    return NextResponse.json(background, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Activation impossible.";
    const status = message.includes("introuvable")
      ? 404
      : message.includes("pret")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
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
    const background = await deleteMapBackground(params.id);

    return NextResponse.json(background, {
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
      : message.includes("actif")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
