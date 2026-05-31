import { NextRequest, NextResponse } from "next/server";

import type { DynamicCaseTableCreateInput } from "@/admin/tech-types";
import { requireTechAdminUser } from "@/server/auth";
import {
  createDynamicCaseTable,
  listDynamicCaseTableSummaries,
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
    const tables = await listDynamicCaseTableSummaries();

    return NextResponse.json(tables, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lecture du schema impossible.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
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
    const body = (await request.json()) as DynamicCaseTableCreateInput;
    const result = await createDynamicCaseTable(body, userId);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Creation de table impossible.";
    const status =
      message.includes("obligatoire") ||
      message.includes("existe deja") ||
      message.includes("snake_case") ||
      message.includes("trop long")
        ? 400
        : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
