import { NextResponse } from "next/server";

import { getPublicCaseSupplement } from "@/server/admin-repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id_case: string }> },
) {
  const params = await context.params;
  const supplement = await getPublicCaseSupplement(params.id_case);

  return NextResponse.json(supplement, {
    status: 200,
    headers: {
      "cache-control": "no-store",
    },
  });
}
