import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { users, predictions } from "../db/schema";

export type BalanceRow = {
  userId: string;
  displayName: string;
  points: number;
};

/** 所持ポイント残高の多い順（通算ランキング＝アマギフ判定の基準）。 */
export async function balanceLeaderboard(db: Db): Promise<BalanceRow[]> {
  return db
    .select({
      userId: users.id,
      displayName: users.displayName,
      points: users.points,
    })
    .from(users)
    .orderBy(desc(users.points))
    .all();
}

export type SeasonProfitRow = {
  userId: string;
  displayName: string;
  staked: number;
  won: number;
  profit: number;
  hitCount: number;
};

/**
 * シーズン内の純損益（精算済み予想のみ）。
 * profit = 配当合計(won) - 賭け額合計(staked)。
 */
export async function seasonProfitLeaderboard(
  db: Db,
  seasonId: string,
): Promise<SeasonProfitRow[]> {
  const rows = await db
    .select({
      userId: predictions.userId,
      displayName: users.displayName,
      staked: sql<number>`sum(${predictions.stake})`,
      won: sql<number>`sum(coalesce(${predictions.payout}, 0))`,
      hitCount: sql<number>`sum(case when ${predictions.payout} > 0 then 1 else 0 end)`,
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(and(eq(predictions.seasonId, seasonId), eq(predictions.settled, true)))
    .groupBy(predictions.userId, users.displayName)
    .all();

  return rows
    .map((r) => ({ ...r, profit: r.won - r.staked }))
    .sort((a, b) => b.profit - a.profit);
}
