import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import process from "node:process";
import { promisify } from "node:util";

import pg from "pg";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;

function getArgumentValue(flag) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function getRequiredValue(options) {
  for (const value of options) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeRole(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value === "staff" || value === "tech_admin") {
    return value;
  }

  throw new Error("Le role doit etre staff ou tech_admin.");
}

async function hashSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(secret, salt, 64);

  return `${salt}:${derivedKey.toString("hex")}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? null;
  const username = getRequiredValue([
    getArgumentValue("--username"),
    process.env.ADMIN_CREATE_USERNAME,
  ]);
  const password = getRequiredValue([
    getArgumentValue("--password"),
    process.env.ADMIN_CREATE_PASSWORD,
  ]);
  const role =
    normalizeRole(getArgumentValue("--role")) ??
    normalizeRole(process.env.ADMIN_CREATE_ROLE) ??
    "tech_admin";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL est requise.");
  }

  if (!username || !password) {
    throw new Error(
      "Usage: npm run create:admin -- --username <identifiant> --password <mot_de_passe> [--role staff|tech_admin]",
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      ALTER TABLE staff_users
      ADD COLUMN IF NOT EXISTS role TEXT
    `);
    await client.query(`
      ALTER TABLE staff_users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN
    `);
    await client.query(`
      UPDATE staff_users
      SET role = 'staff'
      WHERE role IS NULL OR role NOT IN ('staff', 'tech_admin')
    `);
    await client.query(`
      UPDATE staff_users
      SET is_active = TRUE
      WHERE is_active IS NULL
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN role SET DEFAULT 'staff'
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN role SET NOT NULL
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN is_active SET DEFAULT TRUE
    `);
    await client.query(`
      ALTER TABLE staff_users
      ALTER COLUMN is_active SET NOT NULL
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
        session_token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const passwordHash = await hashSecret(password);
    const result = await client.query(
      `
        INSERT INTO staff_users (username, password_hash, role, is_active)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (username) DO UPDATE
        SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING id
      `,
      [username, passwordHash, role],
    );

    const userId = result.rows[0]?.id;

    if (!userId) {
      throw new Error("Impossible de creer ou mettre a jour l'utilisateur admin.");
    }

    await client.query(
      `
        DELETE FROM staff_sessions
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query("COMMIT");
    console.log(`Compte staff pret: ${username} (${role})`);
    console.log("Les anciennes sessions de ce compte ont ete invalidees.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Erreur inconnue.";
  console.error(message);
  process.exit(1);
});
