import { NextRequest, NextResponse } from "next/server";

import type { EditorMapLocalityInput } from "@/editor/types";
import {
  createEditorLocality,
  listEditorLocalities,
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
    const items = await listEditorLocalities(parseEditorListOptions(request));

    return NextResponse.json(items, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture des localites impossible.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const body = (await request.json()) as EditorMapLocalityInput;
    const item = await createEditorLocality(body, guard.userId);

    return NextResponse.json(item, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Creation de localite impossible.");
  }
}
