import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { seasons } from "../db/schema";

export type Season = typeof seasons.$inferSelect;

export async function findSeasonById(
  db: Db,
  id: string,
): Promise<Season | undefined> {
  return db.select().from(seasons).where(eq(seasons.id, id)).get();
}
