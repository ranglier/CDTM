import { NextResponse } from "next/server";

import { getServerEnv } from "@/server/env";

export async function GET() {
  const env = getServerEnv();

  return NextResponse.json(
    {
      status: "ok",
      appEnv: env.appEnv,
      hasDatabaseUrl: Boolean(env.databaseUrl),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
