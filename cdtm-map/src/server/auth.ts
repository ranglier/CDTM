import type { NextRequest, NextResponse } from "next/server";

import { isTechAdminRole, type AdminRole } from "@/admin/roles";
import type { AdminSession } from "@/admin/types";
import { ensureDatabaseReady, getPool } from "@/server/db";
import { getServerEnv } from "@/server/env";
import { createSessionToken, hashToken, verifySecret } from "@/server/security";

type StaffUserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
};

export type AuthenticatedStaffUser = {
  userId: number;
  username: string;
  role: AdminRole;
  isActive: boolean;
};

export type StaffLoginResult = {
  session: AdminSession;
  sessionToken: string;
  expiresAt: Date;
};

const SESSION_COOKIE_NAME = "cdtm_admin_session";

function getSessionExpirationDate(): Date {
  const ttlHours = getServerEnv().sessionTtlHours;

  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().appEnv === "production",
    expires: new Date(0),
    path: "/",
  });
}

export function setAdminSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().appEnv === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function getCurrentStaffUser(
  request: NextRequest,
): Promise<AuthenticatedStaffUser | null> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    return null;
  }

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const result = await getPool().query<{
    user_id: number;
    username: string;
    role: AdminRole;
  }>(
    `
      SELECT sessions.user_id, users.username, users.role
      FROM staff_sessions AS sessions
      INNER JOIN staff_users AS users ON users.id = sessions.user_id
      WHERE sessions.session_token_hash = $1
        AND sessions.expires_at > NOW()
        AND users.is_active = TRUE
      LIMIT 1
    `,
    [tokenHash],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    username: row.username,
    role: row.role,
    isActive: true,
  };
}

export async function requireTechAdminUser(
  request: NextRequest,
): Promise<AuthenticatedStaffUser> {
  const user = await getCurrentStaffUser(request);

  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!isTechAdminRole(user.role)) {
    throw new Error("TECH_ADMIN_REQUIRED");
  }

  return user;
}

export async function getAdminSessionState(request: NextRequest): Promise<AdminSession> {
  const user = await getCurrentStaffUser(request);

  return {
    authenticated: Boolean(user),
    username: user?.username ?? null,
    role: user?.role ?? null,
    is_tech_admin: isTechAdminRole(user?.role ?? null),
  };
}

export async function loginStaffUser(
  username: string,
  password: string,
): Promise<StaffLoginResult> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const normalizedUsername = username.trim();
  const rawPassword = password;

  if (!normalizedUsername || rawPassword.length === 0 || rawPassword.trim().length === 0) {
    throw new Error("Identifiant et mot de passe obligatoires.");
  }

  const result = await getPool().query<StaffUserRow>(
    `
      SELECT id, username, password_hash
           , role
           , is_active
      FROM staff_users
      WHERE username = $1
      LIMIT 1
    `,
    [normalizedUsername],
  );

  const user = result.rows[0];

  if (!user || !user.is_active || !(await verifySecret(rawPassword, user.password_hash))) {
    throw new Error("Identifiants invalides.");
  }

  const rawToken = createSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = getSessionExpirationDate();

  await getPool().query(
    `
      INSERT INTO staff_sessions (user_id, session_token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [user.id, tokenHash, expiresAt.toISOString()],
  );

  await getPool().query(
    `
      UPDATE staff_users
      SET last_login_at = NOW()
      WHERE id = $1
    `,
    [user.id],
  );

  return {
    session: {
      authenticated: true,
      username: user.username,
      role: user.role,
      is_tech_admin: isTechAdminRole(user.role),
    },
    sessionToken: rawToken,
    expiresAt,
  };
}

export async function logoutStaffUser(request: NextRequest, response: NextResponse): Promise<void> {
  const hasDatabase = await ensureDatabaseReady();
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  clearAdminSessionCookie(response);

  if (!hasDatabase || !rawToken) {
    return;
  }

  await getPool().query(
    `
      DELETE FROM staff_sessions
      WHERE session_token_hash = $1
    `,
    [hashToken(rawToken)],
  );
}
