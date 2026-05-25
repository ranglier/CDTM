import { NextRequest, NextResponse } from "next/server";

import type { EditorMapLocalityInput } from "@/editor/types";
import {
  deleteEditorLocality,
  getEditorLocality,
  updateEditorLocality,
} from "@/server/editor-repository";
import { editorErrorResponse, ensureTechAdmin } from "@/app/api/admin/editor/utils";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const params = await context.params;
    const item = await getEditorLocality(params.id);

    return NextResponse.json(item, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture de localite impossible.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const params = await context.params;
    const body = (await request.json()) as EditorMapLocalityInput;
    const item = await updateEditorLocality(params.id, body, guard.userId);

    return NextResponse.json(item, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Mise a jour de localite impossible.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const params = await context.params;
    await deleteEditorLocality(params.id);

    return NextResponse.json(
      { deleted: true, id: params.id },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return editorErrorResponse(error, "Suppression de localite impossible.");
  }
}
