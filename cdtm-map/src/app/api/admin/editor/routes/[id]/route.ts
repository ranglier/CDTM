import { NextRequest, NextResponse } from "next/server";

import type { EditorMapRoutePatch } from "@/editor/types";
import { editorErrorResponse, ensureTechAdmin } from "@/app/api/admin/editor/utils";
import {
  deleteEditorRoute,
  getEditorRoute,
  updateEditorRoute,
} from "@/server/editor-repository";

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
    const item = await getEditorRoute(params.id);

    return NextResponse.json(item, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture de route impossible.");
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
    const body = (await request.json()) as EditorMapRoutePatch;
    const item = await updateEditorRoute(params.id, body, guard.userId);

    return NextResponse.json(item, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Mise a jour de route impossible.");
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
    await deleteEditorRoute(params.id);

    return NextResponse.json(
      { deleted: true, id: params.id },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return editorErrorResponse(error, "Suppression de route impossible.");
  }
}
