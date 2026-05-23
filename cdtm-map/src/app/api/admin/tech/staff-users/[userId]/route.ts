import { NextRequest, NextResponse } from "next/server";

import type { StaffAccountUpdateInput } from "@/admin/tech-types";
import { requireTechAdminUser } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import { updateStaffAccount } from "@/server/staff-account-repository";

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

async function ensureTechAdmin(request: NextRequest) {
  try {
    await requireTechAdminUser(request);
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === "TECH_ADMIN_REQUIRED") {
      return createForbiddenResponse();
    }

    return createUnauthorizedResponse();
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_URL manquante. L'admin n'est pas disponible.",
      },
      { status: 503 },
    );
  }

  const guardResponse = await ensureTechAdmin(request);

  if (guardResponse) {
    return guardResponse;
  }

  try {
    const params = await context.params;
    const body = (await request.json()) as StaffAccountUpdateInput;
    const account = await updateStaffAccount(Number.parseInt(params.userId, 10), body);

    return NextResponse.json(account, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour du compte impossible.";
    const status =
      message.includes("invalide") ||
      message.includes("introuvable") ||
      message.includes("Impossible de retrograder")
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
