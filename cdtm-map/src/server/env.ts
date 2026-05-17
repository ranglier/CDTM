export type ServerEnv = {
  appEnv: string;
  databaseUrl: string | null;
};

export function getServerEnv(): ServerEnv {
  return {
    appEnv: process.env.APP_ENV ?? "development",
    databaseUrl: process.env.DATABASE_URL ?? null,
  };
}
