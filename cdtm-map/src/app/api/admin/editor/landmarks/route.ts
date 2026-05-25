import { NextRequest, NextResponse } from "next/server";

import type { EditorMapLandmarkInput } from "@/editor/types";
import {
  createEditorLandmark,
  listEditorLandmarks,
} from "@/server/editor-repository";
import {
  editorErrorResponse,
  ensureTechAdmin,
  parseEditorListOptions,
} from "@/app/api/admin/editor/utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const items = await listEditorLandmarks(parseEditorListOptions(request));

    return NextResponse.json(items, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture des landmarks impossible.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const body = (await request.json()) as EditorMapLandmarkInput;
    const item = await createEditorLandmark(body, guard.userId);

    return NextResponse.json(item, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Creation de landmark impossible.");
  }
}
