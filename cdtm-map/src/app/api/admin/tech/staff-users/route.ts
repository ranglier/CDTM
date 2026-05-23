import { NextRequest, NextResponse } from "next/server";

import type { StaffAccountCreateInput } from "@/admin/tech-types";
import { requireTechAdminUser } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";
import {
  createStaffAccount,
  listStaffAccounts,
} from "@/server/staff-account-repository";

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

export async function GET(request: NextRequest) {
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
    const accounts = await listStaffAccounts();

    return NextResponse.json(accounts, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture des comptes impossible.";

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

  const guardResponse = await ensureTechAdmin(request);

  if (guardResponse) {
    return guardResponse;
  }

  try {
    const body = (await request.json()) as StaffAccountCreateInput;
    const account = await createStaffAccount(body);

    return NextResponse.json(account, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation de compte impossible.";
    const status =
      message.includes("obligatoires") ||
      message.includes("Role invalide") ||
      message.includes("existe deja")
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
