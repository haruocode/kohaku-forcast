import { Hono } from "hono";
import { getDb } from "../db";
import { requireAuth } from "../auth/session";
import {
  balanceLeaderboard,
  seasonProfitLeaderboard,
  type BalanceRow,
} from "../repositories/leaderboard";
import { findSeasonById } from "../repositories/seasons";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const rankings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/** 競技順位法で順位を振る（同値は同順位）。value 降順前提の配列を受け取る。 */
function withRanks<T extends { value: number }>(sorted: T[]): (T & { rank: number })[] {
  const out: (T & { rank: number })[] = [];
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    const rank = prev && prev.value === row.value ? out[i - 1]!.rank : i + 1;
    out.push({ ...row, rank });
  });
  return out;
}

// 通算ランキング（所持ポイント残高の多い順）。アマギフ判定の基準。
rankings.get("/overall", async (c) => {
  const db = getDb(c.env.DB);
  const rows = await balanceLeaderboard(db);
  const ranked = withRanks(rows.map((r) => ({ ...r, value: r.points })));
  return c.json(
    ranked.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      displayName: r.displayName,
      score: r.points,
    })),
  );
});

// ログインユーザー自身の残高と順位（ヘッダー表示用）。
rankings.get("/me", requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("userId");
  const rows: BalanceRow[] = await balanceLeaderboard(db);
  const mine = rows.find((r) => r.userId === userId);
  const score = mine?.points ?? 0;
  // 自分より残高が多い人数 + 1 が順位（同値は同順位）。
  const rank = mine ? rows.filter((r) => r.points > score).length + 1 : null;
  return c.json({ score, rank, totalUsers: rows.length });
});

// シーズンのランキング（精算済みの純損益順）。
rankings.get("/:seasonId", async (c) => {
  const db = getDb(c.env.DB);
  const season = await findSeasonById(db, c.req.param("seasonId"));
  if (!season) {
    return c.json(errorBody("NOT_FOUND", "シーズンが見つかりません"), 404);
  }
  if (season.predictionCloseAt === null) {
    return c.json(
      errorBody("CONFLICT", "ランキングはまだ確定していません（締切前）"),
      409,
    );
  }

  const rows = await seasonProfitLeaderboard(db, season.id);
  const ranked = withRanks(rows.map((r) => ({ ...r, value: r.profit })));
  return c.json(
    ranked.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      displayName: r.displayName,
      score: r.profit,
      staked: r.staked,
      won: r.won,
      hitCount: r.hitCount,
    })),
  );
});

export default rankings;
