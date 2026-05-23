import { NextResponse } from "next/server";

import { ensureDatabaseReady, getPool } from "@/server/db";
import { getServerEnv } from "@/server/env";

export const runtime = "nodejs";

export async function GET() {
  const env = getServerEnv();

  if (!env.databaseUrl) {
    return NextResponse.json(
      {
        status: "ok",
        appEnv: env.appEnv,
        database: {
          configured: false,
          ready: false,
        },
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    await ensureDatabaseReady();
    await getPool().query("SELECT 1");

    return NextResponse.json(
      {
        status: "ok",
        appEnv: env.appEnv,
        database: {
          configured: true,
          ready: true,
        },
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        appEnv: env.appEnv,
        database: {
          configured: true,
          ready: false,
        },
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
