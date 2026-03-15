import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

declare global {
  // eslint-disable-next-line no-var
  var __bingoPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: env.databaseUrl(),
    max: 10,
  });
}

const pool = global.__bingoPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__bingoPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
