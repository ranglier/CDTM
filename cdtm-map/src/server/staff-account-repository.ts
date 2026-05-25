import type { PoolClient } from "pg";

import { isAdminRole, isTechAdminRole, type AdminRole } from "@/admin/roles";
import type {
  StaffAccountCreateInput,
  StaffAccountSummary,
  StaffAccountUpdateInput,
} from "@/admin/tech-types";
import { ensureDatabaseReady, getPool } from "@/server/db";
import { hashSecret } from "@/server/security";

type StaffAccountRow = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: Date | string;
  last_login_at: Date | string | null;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: unknown, fallback: AdminRole | null = null): AdminRole {
  if (isAdminRole(value)) {
    return value;
  }

  if (fallback) {
    return fallback;
  }

  throw new Error("Role invalide.");
}

function toIsoString(value: Date | string): string {
  return new Date(value).toISOString();
}

function mapAccountRow(row: StaffAccountRow): StaffAccountSummary {
  return {
    id: row.id,
    username: row.username,
    role: normalizeRole(row.role, "staff"),
    is_active: row.is_active,
    created_at: toIsoString(row.created_at),
    last_login_at: row.last_login_at ? toIsoString(row.last_login_at) : null,
  };
}

async function listAccountsInternal(client: PoolClient): Promise<StaffAccountSummary[]> {
  const result = await client.query<StaffAccountRow>(
    `
      SELECT id, username, role, is_active, created_at, last_login_at
      FROM staff_users
      ORDER BY username ASC
    `,
  );

  return result.rows.map(mapAccountRow);
}

async function countOtherActiveTechAdmins(
  client: PoolClient,
  excludedUserId: number,
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM staff_users
      WHERE id <> $1
        AND role = 'tech_admin'
        AND is_active = TRUE
    `,
    [excludedUserId],
  );

  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

async function invalidateUserSessions(client: PoolClient, userId: number): Promise<void> {
  await client.query(
    `
      DELETE FROM staff_sessions
      WHERE user_id = $1
    `,
    [userId],
  );
}

async function ensureRoleChangeSafe(
  client: PoolClient,
  currentAccount: StaffAccountSummary,
  nextRole: AdminRole,
  nextIsActive: boolean,
): Promise<void> {
  const currentlyActiveTechAdmin =
    currentAccount.is_active && isTechAdminRole(currentAccount.role);
  const remainsActiveTechAdmin = nextIsActive && isTechAdminRole(nextRole);

  if (!currentlyActiveTechAdmin || remainsActiveTechAdmin) {
    return;
  }

  const remainingTechAdmins = await countOtherActiveTechAdmins(client, currentAccount.id);

  if (remainingTechAdmins === 0) {
    throw new Error(
      "Impossible de retrograder ou desactiver le dernier administrateur technique actif.",
    );
  }
}

export async function listStaffAccounts(): Promise<StaffAccountSummary[]> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const client = await getPool().connect();

  try {
    return await listAccountsInternal(client);
  } finally {
    client.release();
  }
}

export async function createStaffAccount(
  input: StaffAccountCreateInput,
): Promise<StaffAccountSummary> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  const username = normalizeText(input.username);
  const rawPassword = typeof input.password === "string" ? input.password : "";
  const role = normalizeRole(input.role, "staff");

  if (!username || rawPassword.length === 0 || rawPassword.trim().length === 0) {
    throw new Error("Identifiant et mot de passe obligatoires.");
  }

  const passwordHash = await hashSecret(rawPassword);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<StaffAccountRow>(
      `
        INSERT INTO staff_users (username, password_hash, role, is_active)
        VALUES ($1, $2, $3, TRUE)
        RETURNING id, username, role, is_active, created_at, last_login_at
      `,
      [username, passwordHash, role],
    );
    await client.query("COMMIT");

    const row = result.rows[0];

    if (!row) {
      throw new Error("Creation de compte impossible.");
    }

    return mapAccountRow(row);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof Error && error.message.includes("duplicate key")) {
      throw new Error("Un compte avec cet identifiant existe deja.");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function updateStaffAccount(
  userId: number,
  patch: StaffAccountUpdateInput,
): Promise<StaffAccountSummary> {
  const hasDatabase = await ensureDatabaseReady();

  if (!hasDatabase) {
    throw new Error("La base de donnees n'est pas configuree.");
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Identifiant de compte invalide.");
  }

  const rawPassword = typeof patch.password === "string" ? patch.password : null;
  const hasPasswordChange = rawPassword !== null && rawPassword.length > 0;
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<StaffAccountRow>(
      `
        SELECT id, username, role, is_active, created_at, last_login_at
        FROM staff_users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );

    const currentRow = currentResult.rows[0];

    if (!currentRow) {
      throw new Error("Compte staff introuvable.");
    }

    const currentAccount = mapAccountRow(currentRow);
    const nextRole = patch.role ? normalizeRole(patch.role) : currentAccount.role;
    const nextIsActive = patch.is_active ?? currentAccount.is_active;

    if (rawPassword !== null && rawPassword.length > 0 && rawPassword.trim().length === 0) {
      throw new Error("Le mot de passe ne peut pas etre vide.");
    }

    await ensureRoleChangeSafe(client, currentAccount, nextRole, nextIsActive);

    const updates: string[] = [];
    const values: Array<string | boolean | number> = [];
    let valueIndex = 1;

    if (patch.role !== undefined) {
      updates.push(`role = $${valueIndex++}`);
      values.push(nextRole);
    }

    if (patch.is_active !== undefined) {
      updates.push(`is_active = $${valueIndex++}`);
      values.push(nextIsActive);
    }

    if (hasPasswordChange) {
      const passwordHash = await hashSecret(rawPassword as string);
      updates.push(`password_hash = $${valueIndex++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      await client.query("ROLLBACK");
      return currentAccount;
    }

    updates.push("updated_at = NOW()");
    values.push(userId);

    const updateResult = await client.query<StaffAccountRow>(
      `
        UPDATE staff_users
        SET ${updates.join(", ")}
        WHERE id = $${valueIndex}
        RETURNING id, username, role, is_active, created_at, last_login_at
      `,
      values,
    );

    const shouldInvalidateSessions =
      hasPasswordChange ||
      (patch.role !== undefined && patch.role !== currentAccount.role) ||
      (patch.is_active !== undefined && patch.is_active !== currentAccount.is_active);

    if (shouldInvalidateSessions) {
      await invalidateUserSessions(client, userId);
    }

    await client.query("COMMIT");

    const updatedRow = updateResult.rows[0];

    if (!updatedRow) {
      throw new Error("Mise a jour du compte impossible.");
    }

    return mapAccountRow(updatedRow);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
