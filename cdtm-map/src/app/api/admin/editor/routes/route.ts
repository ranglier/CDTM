import { NextRequest, NextResponse } from "next/server";

import type { EditorMapRouteInput } from "@/editor/types";
import { editorErrorResponse, ensureTechAdmin, parseEditorListOptions } from "@/app/api/admin/editor/utils";
import { createEditorRoute, listEditorRoutes } from "@/server/editor-repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const items = await listEditorRoutes(parseEditorListOptions(request));

    return NextResponse.json(items, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture des routes impossible.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const body = (await request.json()) as EditorMapRouteInput;
    const item = await createEditorRoute(body, guard.userId);

    return NextResponse.json(item, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Creation de route impossible.");
  }
}
