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

/** 締切操作: 公式発表の日時を prediction_close_at に設定する */
export async function closeSeason(
  db: Db,
  id: string,
  announcedAt: string,
): Promise<Season> {
  return db
    .update(seasons)
    .set({ predictionCloseAt: announcedAt, updatedAt: new Date().toISOString() })
    .where(eq(seasons.id, id))
    .returning()
    .get();
}
