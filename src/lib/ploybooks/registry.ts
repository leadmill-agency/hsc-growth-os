import type { Db } from "@/lib/db/client";
import { ploybooks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { PloybookDefinition } from "./types";

const definitions = new Map<string, PloybookDefinition>();

export function registerPloybook(def: PloybookDefinition) {
  definitions.set(def.key, def);
}

export function getPloybook(key: string): PloybookDefinition {
  const def = definitions.get(key);
  if (!def) throw new Error(`Unknown ploybook: ${key}`);
  return def;
}

export function listPloybooks(): PloybookDefinition[] {
  return [...definitions.values()];
}

/** Upsert a registered definition into the ploybooks table; returns the row id. */
export async function ensurePloybookRow(db: Db, key: string): Promise<string> {
  const def = getPloybook(key);
  const existing = await db.query.ploybooks.findFirst({ where: eq(ploybooks.key, key) });
  if (existing) {
    if (existing.version !== def.version || existing.name !== def.name) {
      await db
        .update(ploybooks)
        .set({
          name: def.name,
          description: def.description,
          version: def.version,
          triggerTypes: def.triggerTypes,
        })
        .where(eq(ploybooks.id, existing.id));
    }
    return existing.id;
  }
  const [row] = await db
    .insert(ploybooks)
    .values({
      key: def.key,
      name: def.name,
      description: def.description,
      version: def.version,
      triggerTypes: def.triggerTypes,
    })
    .returning();
  return row.id;
}
