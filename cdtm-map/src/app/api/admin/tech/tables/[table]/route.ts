import { NextRequest, NextResponse } from "next/server";

import { getTechTableDefinition, type TechTableKey } from "@/admin/tech-types";
import { getCurrentStaffUser } from "@/server/auth";
import {
  deleteBusinessTableRow,
  listBusinessTableRows,
  saveBusinessTableRow,
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

function parseTableKey(rawTable: string): TechTableKey {
  const definition = getTechTableDefinition(rawTable);

  if (!definition) {
    throw new Error(`Table technique inconnue: ${rawTable}`);
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

  const user = await getCurrentStaffUser(request);

  if (!user) {
    return createUnauthorizedResponse();
  }

  try {
    const params = await context.params;
    const tableKey = parseTableKey(params.table);
    const limitValue = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10);
    const rows = await listBusinessTableRows(tableKey, {
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
    const message = error instanceof Error ? error.message : "Lecture de table impossible.";
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

  const user = await getCurrentStaffUser(request);

  if (!user) {
    return createUnauthorizedResponse();
  }

  try {
    const params = await context.params;
    const tableKey = parseTableKey(params.table);
    const body = (await request.json()) as {
      row?: unknown;
    };
    const row = await saveBusinessTableRow(tableKey, body.row ?? {}, user.userId);

    return NextResponse.json(row, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enregistrement de table impossible.";
    const status =
      message.includes("invalide") ||
      message.includes("obligatoire") ||
      message.includes("introuvable") ||
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

  const user = await getCurrentStaffUser(request);

  if (!user) {
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
    const tableKey = parseTableKey(params.table);
    await deleteBusinessTableRow(tableKey, primaryKeyValue);

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
