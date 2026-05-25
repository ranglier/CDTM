import { NextRequest, NextResponse } from "next/server";

import type { EditorMapForceInput } from "@/editor/types";
import {
  createEditorForce,
  listEditorForces,
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
    const items = await listEditorForces(parseEditorListOptions(request));

    return NextResponse.json(items, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Lecture des forces impossible.");
  }
}

export async function POST(request: NextRequest) {
  const guard = await ensureTechAdmin(request);

  if (guard instanceof NextResponse) {
    return guard;
  }

  try {
    const body = (await request.json()) as EditorMapForceInput;
    const item = await createEditorForce(body, guard.userId);

    return NextResponse.json(item, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return editorErrorResponse(error, "Creation de force impossible.");
  }
}
