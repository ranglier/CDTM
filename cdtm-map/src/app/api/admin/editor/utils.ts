import { NextRequest, NextResponse } from "next/server";

import { requireTechAdminUser } from "@/server/auth";
import { EditorEntityNotFoundError } from "@/server/editor-repository";

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
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (error instanceof EditorEntityNotFoundError || message.includes("introuvable")) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (
    message.includes("obligatoire") ||
    message.includes("invalide") ||
    message.includes("impossible") ||
    message.includes("depend") ||
    message.includes("Statut")
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
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
