type ServerEnv = {
  appEnv: string;
  databaseUrl: string | null;
  bootstrapAdminUsername: string | null;
  bootstrapAdminPassword: string | null;
  sessionTtlHours: number;
  uploadsDir: string;
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getServerEnv(): ServerEnv {
  const appEnv = process.env.APP_ENV ?? "development";

  return {
    appEnv,
    databaseUrl: process.env.DATABASE_URL ?? null,
    bootstrapAdminUsername: process.env.ADMIN_USERNAME ?? null,
    bootstrapAdminPassword: process.env.ADMIN_PASSWORD ?? null,
    sessionTtlHours: parsePositiveInteger(process.env.ADMIN_SESSION_TTL_HOURS, 168),
    uploadsDir: process.env.UPLOADS_DIR ?? (appEnv === "production" ? "/app/uploads" : "./uploads"),
  };
}
