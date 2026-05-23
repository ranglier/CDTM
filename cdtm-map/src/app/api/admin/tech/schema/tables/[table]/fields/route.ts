import { NextRequest, NextResponse } from "next/server";

import type { DynamicCaseTableFieldCreateInput } from "@/admin/tech-types";
import { getCurrentStaffUser } from "@/server/auth";
import { addDynamicCaseTableField } from "@/server/admin-tech-repository";
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
    const body = (await request.json()) as DynamicCaseTableFieldCreateInput;
    const result = await addDynamicCaseTableField(params.table, body, user.userId);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ajout de champ impossible.";
    const status =
      message.includes("obligatoire") ||
      message.includes("snake_case") ||
      message.includes("existe deja") ||
      message.includes("requiert")
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
