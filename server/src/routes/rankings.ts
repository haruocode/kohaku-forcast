import { Hono } from "hono";
import { getDb } from "../db";
import { displayScore } from "../domain/scoring";
import {
  computeRanking,
  type RankablePrediction,
  type ResultsByArtist,
} from "../domain/ranking";
import { findSeasonById } from "../repositories/seasons";
import { listPredictions } from "../repositories/predictions";
import { listResultsBySeason } from "../repositories/results";
import { findUsersByIds } from "../repositories/users";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const rankings = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

  // 受付開始が未設定なら早押しボーナスは無効化（span<=0 → 倍率1.0）
  const window = {
    openAt: season.predictionOpenAt ?? season.predictionCloseAt,
    closeAt: season.predictionCloseAt,
  };

  const ranked = computeRanking(predictions, results, window);

  const users = await findUsersByIds(db, ranked.map((e) => e.userId));
  const nameById = new Map(users.map((u) => [u.id, u.displayName]));

  return c.json(
    ranked.map((e) => ({
      rank: e.rank,
      userId: e.userId,
      displayName: nameById.get(e.userId) ?? "(unknown)",
      score: displayScore(e.totalScore),
      hitCount: e.hitCount,
    })),
  );
});

export default rankings;
