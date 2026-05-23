import { NextRequest, NextResponse } from "next/server";

import {
  getReferenceTableDefinition,
  type ReferenceTableKey,
} from "@/admin/tech-types";
import { requireTechAdminUser } from "@/server/auth";
import {
  deleteReferenceTableRow,
  listReferenceTableRows,
  saveReferenceTableRow,
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

function parseReferenceTableKey(rawTable: string): ReferenceTableKey {
  const definition = getReferenceTableDefinition(rawTable);

  if (!definition) {
    throw new Error(`Table de reference inconnue: ${rawTable}`);
  }

  return definition.key;
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
    const tableKey = parseReferenceTableKey(params.table);
    const limitValue = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10);
    const rows = await listReferenceTableRows(tableKey, {
      search: request.nextUrl.searchParams.get("search") ?? "",
      limit: Number.isNaN(limitValue) ? 100 : limitValue,
    });

    return NextResponse.json(rows, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture du referentiel impossible.";
    const status = message.includes("inconnue") ? 404 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function POST(
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
    const tableKey = parseReferenceTableKey(params.table);
    const body = (await request.json()) as { row?: unknown };
    const row = await saveReferenceTableRow(tableKey, body.row ?? {}, userId);

    return NextResponse.json(row, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enregistrement du referentiel impossible.";
    const status =
      message.includes("invalide") ||
      message.includes("obligatoire") ||
      message.includes("utilisee")
        ? 400
        : message.includes("inconnue")
          ? 404
          : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}

export async function DELETE(
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

  const primaryKeyValue = request.nextUrl.searchParams.get("pk")?.trim() ?? "";

  if (!primaryKeyValue) {
    return NextResponse.json(
      {
        error: "La cle primaire de la ligne a supprimer est manquante.",
      },
      { status: 400 },
    );
  }

  try {
    const params = await context.params;
    const tableKey = parseReferenceTableKey(params.table);
    await deleteReferenceTableRow(tableKey, primaryKeyValue);

    return NextResponse.json(
      {
        deleted: true,
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suppression impossible.";
    const status = message.includes("inconnue") ? 404 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
