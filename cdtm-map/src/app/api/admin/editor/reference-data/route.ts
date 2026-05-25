import { NextRequest, NextResponse } from "next/server";

import { getEditorReferenceData } from "@/server/editor-repository";
import { editorErrorResponse, ensureTechAdmin } from "@/app/api/admin/editor/utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const data = await getEditorReferenceData();

    return NextResponse.json(data, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture des referentiels editeur impossible.");
  }
}
