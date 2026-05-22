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

  if (!databaseUrl) {
    throw new Error("DATABASE_URL est requise.");
  }

  if (!username || !password) {
    throw new Error(
      "Usage: npm run create:admin -- --username <identifiant> --password <mot_de_passe>",
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      )
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
        INSERT INTO staff_users (username, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (username) DO UPDATE
        SET
          password_hash = EXCLUDED.password_hash,
          updated_at = NOW()
        RETURNING id
      `,
      [username, passwordHash],
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
    console.log(`Utilisateur admin pret: ${username}`);
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
