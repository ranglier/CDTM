import { NextRequest, NextResponse } from "next/server";

import type { DynamicCaseTableUpdateInput } from "@/admin/tech-types";
import { requireTechAdminUser } from "@/server/auth";
import {
  getDynamicCaseTableDefinition,
  updateDynamicCaseTable,
} from "@/server/admin-tech-repository";
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ table: string }> },
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
    const definition = await getDynamicCaseTableDefinition(params.table);

    if (!definition) {
      return NextResponse.json(
        {
          error: `Table metier inconnue: ${params.table}`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(definition, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture de table impossible.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ table: string }> },
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
    const body = (await request.json()) as DynamicCaseTableUpdateInput;
    const definition = await updateDynamicCaseTable(params.table, body, userId);

    return NextResponse.json(definition, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour de table impossible.";
    const status = message.includes("inconnue") ? 404 : 400;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
