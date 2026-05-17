import { readdir } from "node:fs/promises";
import path from "node:path";

import { getServerEnv } from "@/server/env";

export type BootstrapStatus = {
  hasDatabaseUrl: boolean;
  exampleFiles: string[];
};

export async function getBootstrapStatus(): Promise<BootstrapStatus> {
  const env = getServerEnv();
  const examplesDir = path.join(process.cwd(), "data/examples");
  const exampleFiles = (await readdir(examplesDir)).sort();

  return {
    hasDatabaseUrl: Boolean(env.databaseUrl),
    exampleFiles,
  };
}
