import { NextRequest, NextResponse } from "next/server";

import { getCurrentStaffUser } from "@/server/auth";
import { AdminCaseNotFoundError, getAdminCaseRecord, saveAdminCaseRecord } from "@/server/admin-repository";
import { parseAdminCaseDraft } from "@/server/admin-validation";
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id_case: string }> },
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
    const record = await getAdminCaseRecord(params.id_case);

    return NextResponse.json(record, {
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

    const message = error instanceof Error ? error.message : "Lecture admin impossible.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id_case: string }> },
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
    const draft = parseAdminCaseDraft(await request.json());
    const record = await saveAdminCaseRecord(params.id_case, draft, user.userId);

    return NextResponse.json(record, {
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

    const message = error instanceof Error ? error.message : "Enregistrement admin impossible.";
    const status = message.includes("invalide") || message.includes("requiert") ? 400 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
