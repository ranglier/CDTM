import { NextRequest, NextResponse } from "next/server";

import {
  getAdminSessionState,
  loginStaffUser,
  logoutStaffUser,
  setAdminSessionCookie,
} from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getAdminSessionState(request);

  return NextResponse.json(session, {
    status: 200,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error: "DATABASE_URL manquante. L'admin n'est pas disponible.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const login = await loginStaffUser(
      typeof body.username === "string" ? body.username : "",
      typeof body.password === "string" ? body.password : "",
    );
    const response = NextResponse.json(login.session, {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    });
    setAdminSessionCookie(response, login.sessionToken, login.expiresAt);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connexion staff impossible.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 401 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json(
    {
      authenticated: false,
      username: null,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );

  await logoutStaffUser(request, response);

  return response;
}
