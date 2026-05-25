import { NextRequest, NextResponse } from "next/server";

import type { EditorMapForceInput } from "@/editor/types";
import {
  deleteEditorForce,
  getEditorForce,
  updateEditorForce,
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
    const item = await getEditorForce(params.id);

    return NextResponse.json(item, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture de force impossible.");
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
    const body = (await request.json()) as EditorMapForceInput;
    const item = await updateEditorForce(params.id, body, guard.userId);

    return NextResponse.json(item, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Mise a jour de force impossible.");
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
    await deleteEditorForce(params.id);

    return NextResponse.json(
      { deleted: true, id: params.id },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return editorErrorResponse(error, "Suppression de force impossible.");
  }
}
