import type { Db } from "../db";
import { computeAwards } from "../domain/distribution";
import type { RankablePrediction, ResultsByArtist } from "../domain/ranking";
import { listPredictions } from "../repositories/predictions";
import { listResultsBySeason } from "../repositories/results";
import { findUsersByIds } from "../repositories/users";
import {
  findAward,
  upsertPendingAward,
  markAwardSent,
  markAwardFailed,
} from "../repositories/tokenAwards";
import type { Season } from "../repositories/seasons";
import type { Minter } from "../token/minter";

export type DistributionSummary = {
  /** 配布対象（スコア>0）の人数 */
  total: number;
  sent: number;
  failed: number;
  /** ウォレット未連携でスキップした人数 */
  skipped: number;
  alreadySent: number;
};

/**
 * シーズンの記念トークンを配布する（冪等）。
 * - 配布量は的中スコア。ウォレット未連携はスキップ。
 * - token_awards で (user, season) 一意。既に sent のものは再 mint しない。
 */
export async function distributeSeasonTokens(
  db: Db,
  season: Season,
  minter: Minter,
): Promise<DistributionSummary> {
  const closeAt = season.predictionCloseAt;
  if (closeAt === null) {
    throw new Error("season is not closed");
  }
  const window = { openAt: season.predictionOpenAt ?? closeAt, closeAt };

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

  const awards = computeAwards(predictions, results, window);

  const users = await findUsersByIds(db, awards.map((a) => a.userId));
  const walletById = new Map(users.map((u) => [u.id, u.solanaAddress]));

  const summary: DistributionSummary = {
    total: awards.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    alreadySent: 0,
  };

  for (const award of awards) {
    const address = walletById.get(award.userId) ?? null;
    if (!address) {
      summary.skipped += 1; // ウォレット未連携には配布しない
      continue;
    }

    const existing = await findAward(db, award.userId, season.id);
    if (existing?.status === "sent") {
      summary.alreadySent += 1; // 二重配布しない
      continue;
    }

    const row = await upsertPendingAward(db, {
      userId: award.userId,
      seasonId: season.id,
      amount: award.amount,
      solanaAddress: address,
    });

    try {
      const sig = await minter.mintTo(address, award.amount);
      await markAwardSent(db, row.id, sig);
      summary.sent += 1;
    } catch {
      await markAwardFailed(db, row.id);
      summary.failed += 1;
    }
  }

  return summary;
}
