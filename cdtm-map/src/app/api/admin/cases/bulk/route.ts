import { NextRequest, NextResponse } from "next/server";

import { getCurrentStaffUser } from "@/server/auth";
import {
  AdminCaseNotFoundError,
  saveAdminCaseBulkPatch,
} from "@/server/admin-repository";
import { parseAdminBulkPatch } from "@/server/admin-validation";
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

function parseCaseIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("La liste id_cases est invalide.");
  }

  const normalizedIds = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (normalizedIds.length === 0) {
    throw new Error("Aucune case n'a ete fournie pour l'edition de masse.");
  }

  return normalizedIds;
}

export async function PATCH(request: NextRequest) {
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
    const body = (await request.json()) as {
      id_cases?: unknown;
      patch?: unknown;
    };
    const idCases = parseCaseIds(body.id_cases);
    const patch = parseAdminBulkPatch(body.patch ?? {});
    const result = await saveAdminCaseBulkPatch(idCases, patch, user.userId);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AdminCaseNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 },
      );
    }

    const message = error instanceof Error ? error.message : "Edition de masse impossible.";
    const status = message.includes("invalide") || message.includes("requiert") ? 400 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
