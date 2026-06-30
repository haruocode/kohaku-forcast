import { Hono } from "hono";
import { getDb } from "../db";
import type { Db } from "../db";
import { requireAuth } from "../auth/session";
import { displayScore } from "../domain/scoring";
import {
  computeRanking,
  combineRankings,
  type RankablePrediction,
  type RankEntry,
  type ResultsByArtist,
} from "../domain/ranking";
import { findSeasonById, listSeasons } from "../repositories/seasons";
import type { Season } from "../repositories/seasons";
import { listPredictions } from "../repositories/predictions";
import { listResultsBySeason } from "../repositories/results";
import { findUsersByIds } from "../repositories/users";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const rankings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/** 1シーズンの順位を算出する（採点・早押し・不正投票除外を含む） */
async function rankSeason(db: Db, season: Season): Promise<RankEntry[]> {
  const [predictionRows, resultRows] = await Promise.all([
    listPredictions(db, season.id),
    listResultsBySeason(db, season.id),
  ]);

  const results: ResultsByArtist = new Map(
    resultRows.map((r) => [r.artistId, { appeared: r.appeared, actualSongId: r.songId }]),
  );

  const predictions: RankablePrediction[] = predictionRows.map((p) => ({
    userId: p.userId,
    artistId: p.artistId,
    predictedSongId: p.songId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  // 受付開始が未設定なら早押しボーナスは無効化（span<=0 → 倍率1.0）。
  // 締切後のみ呼ぶ前提なので predictionCloseAt は非 null。
  const window = {
    openAt: season.predictionOpenAt ?? season.predictionCloseAt!,
    closeAt: season.predictionCloseAt!,
  };

  return computeRanking(predictions, results, window);
}

/** RankEntry[] に表示名を添えてレスポンス形へ整形する */
async function withDisplayNames(db: Db, ranked: RankEntry[]) {
  const users = await findUsersByIds(db, ranked.map((e) => e.userId));
  const nameById = new Map(users.map((u) => [u.id, u.displayName]));
  return ranked.map((e) => ({
    rank: e.rank,
    userId: e.userId,
    displayName: nameById.get(e.userId) ?? "(unknown)",
    score: displayScore(e.totalScore),
    hitCount: e.hitCount,
  }));
}

/** 締切済み全シーズンを合算した通算ランキングを返す */
async function computeOverall(db: Db): Promise<RankEntry[]> {
  const closedSeasons = (await listSeasons(db)).filter(
    (s) => s.predictionCloseAt !== null,
  );
  const seasonRankings = await Promise.all(
    closedSeasons.map((s) => rankSeason(db, s)),
  );
  return combineRankings(seasonRankings);
}

// 通算ランキング（結果確定済み＝締切済み全シーズンのスコア合算）。
// /:seasonId より先に登録する（"overall" がパスパラメータに食われないように）。
rankings.get("/overall", async (c) => {
  const db = getDb(c.env.DB);
  const overall = await computeOverall(db);
  return c.json(await withDisplayNames(db, overall));
});

// ログインユーザー自身の通算ポイント・順位（ヘッダー表示用）。
// 未参加（締切済みシーズンでの予想なし）でも 0 ポイントとして返す。
rankings.get("/me", requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("userId");
  const overall = await computeOverall(db);
  const mine = overall.find((e) => e.userId === userId);
  return c.json({
    score: mine ? displayScore(mine.totalScore) : 0,
    rank: mine?.rank ?? null,
    hitCount: mine?.hitCount ?? 0,
    totalUsers: overall.length,
  });
});

// シーズンのランキング（結果確定後）
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

  const ranked = await rankSeason(db, season);
  return c.json(await withDisplayNames(db, ranked));
});

export default rankings;
