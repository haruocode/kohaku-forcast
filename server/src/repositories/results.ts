import { and, eq } from "drizzle-orm";
import type { Db } from "../db";
import { results } from "../db/schema";

export type Result = typeof results.$inferSelect;

export type ResultEntry = {
  artistId: string;
  appeared: boolean;
  /** appeared=false のときは無視され NULL になる */
  songId?: string | null;
};

/**
 * シーズンの結果を1件 upsert する（(season_id, artist_id) で一意）。
 * 未出場（appeared=false）なら songId は強制的に NULL。
 */
export async function upsertResult(
  db: Db,
  seasonId: string,
  entry: ResultEntry,
): Promise<void> {
  const songId = entry.appeared ? entry.songId ?? null : null;
  const nowIso = new Date().toISOString();

  await db
    .insert(results)
    .values({
      seasonId,
      artistId: entry.artistId,
      appeared: entry.appeared,
      songId,
    })
    .onConflictDoUpdate({
      target: [results.seasonId, results.artistId],
      set: { appeared: entry.appeared, songId, updatedAt: nowIso },
    })
    .run();
}

/** シーズンの結果をまとめて upsert する */
export async function upsertResults(
  db: Db,
  seasonId: string,
  entries: ResultEntry[],
): Promise<void> {
  for (const entry of entries) {
    await upsertResult(db, seasonId, entry);
  }
}

/** シーズンの結果一覧 */
export async function listResultsBySeason(
  db: Db,
  seasonId: string,
): Promise<Result[]> {
  return db.select().from(results).where(eq(results.seasonId, seasonId)).all();
}

/** シーズン・アーティストの結果を取得 */
export async function findResult(
  db: Db,
  seasonId: string,
  artistId: string,
): Promise<Result | undefined> {
  return db
    .select()
    .from(results)
    .where(and(eq(results.seasonId, seasonId), eq(results.artistId, artistId)))
    .get();
}
