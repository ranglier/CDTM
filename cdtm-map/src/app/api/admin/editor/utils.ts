import { NextRequest, NextResponse } from "next/server";

import { requireTechAdminUser } from "@/server/auth";
import {
  EditorConflictError,
  EditorEntityNotFoundError,
  EditorValidationError,
} from "@/server/editor-errors";

export async function ensureTechAdmin(request: NextRequest) {
  try {
    return await requireTechAdminUser(request);
  } catch (error) {
    if (error instanceof Error && error.message === "TECH_ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Cette API est reservee aux administrateurs techniques." },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: "Acces admin non autorise." }, { status: 401 });
  }
}

export function editorErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof EditorValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof EditorEntityNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof EditorConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export function parseEditorListOptions(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  return {
    status: searchParams.get("status"),
    type_key: searchParams.get("type_key"),
    faction: searchParams.get("faction"),
    controleur: searchParams.get("controleur"),
    search: searchParams.get("search"),
    limit: searchParams.has("limit") ? Number.parseInt(searchParams.get("limit") ?? "", 10) : null,
  };
}
