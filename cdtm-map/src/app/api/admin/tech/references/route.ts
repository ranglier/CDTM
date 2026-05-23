import { NextRequest, NextResponse } from "next/server";

import { requireTechAdminUser } from "@/server/auth";
import { listReferenceTableStatuses } from "@/server/admin-tech-repository";
import { isDatabaseConfigured } from "@/server/db";

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

export async function GET(request: NextRequest) {
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
    const tables = await listReferenceTableStatuses();

    return NextResponse.json(tables, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture des referentiels impossible.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
