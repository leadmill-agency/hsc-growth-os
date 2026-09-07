import * as schema from "./schema";

// DATABASE_URL set (Supabase/Postgres in prod) => postgres-js driver.
// Unset (local dev/tests) => PGlite at .data/dev, or in-memory when PGLITE_MEMORY=true.
// Both run the same generated SQL migrations from /drizzle.

export type Db = ReturnType<typeof buildPostgres> extends Promise<infer T> ? T : never;

async function buildPostgres() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { prepare: false }); // prepare:false for Supabase pooler
    return drizzle(sql, { schema });
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  let dataDir: string | undefined;
  if (process.env.PGLITE_MEMORY !== "true") {
    dataDir = ".data/dev";
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dataDir, { recursive: true }); // PGlite won't create parent dirs itself
  }
  const pglite = new PGlite(dataDir);
  return drizzle(pglite, { schema });
}

async function migrateDb(db: Awaited<ReturnType<typeof buildPostgres>>) {
  if (process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
  }
}

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await buildPostgres();
      await migrateDb(db);
      return db as Db;
    })();
  }
  return dbPromise;
}

/** Test-only: force a fresh in-memory database. */
export function resetDbForTests() {
  dbPromise = null;
}

export { schema };
