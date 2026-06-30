import type { Db } from "../db";
import type { Season } from "../repositories/seasons";
import { listPredictions, markSettled } from "../repositories/predictions";
import { listResultsBySeason } from "../repositories/results";
import { applyPointChange } from "../repositories/points";
import { settlePayout } from "../domain/betting";
import type { ResultsByArtist } from "../domain/ranking";

export type SettlementSummary = {
  settledCount: number;
  totalPayout: number;
};

/**
 * シーズンの未精算予想を精算する（締切済み前提）。
 * - 的中: 配当を残高へ加算（台帳 payout）。
 * - 外れ/不正: 配当0（賭け額は没収。残高変動なし）。
 * - settled フラグで冪等。再実行しても精算済みは触らない。
 */
export async function settleSeason(
  db: Db,
  season: Season,
): Promise<SettlementSummary> {
  const resultRows = await listResultsBySeason(db, season.id);
  const results: ResultsByArtist = new Map(
    resultRows.map((r) => [r.artistId, { appeared: r.appeared, actualSongId: r.songId }]),
  );

  const window = {
    openAt: season.predictionOpenAt ?? season.predictionCloseAt!,
    closeAt: season.predictionCloseAt!,
  };

  const all = await listPredictions(db, season.id);
  const pending = all.filter((p) => !p.settled);

  let settledCount = 0;
  let totalPayout = 0;

  for (const p of pending) {
    const result = results.get(p.artistId) ?? null;
    const payout = settlePayout(
      { stake: p.stake, predictedSongId: p.songId, updatedAt: p.updatedAt },
      result,
      window,
    );
    if (payout > 0) {
      await applyPointChange(db, p.userId, payout, "payout", {
        refId: p.id,
        note: "的中配当",
      });
      totalPayout += payout;
    }
    await markSettled(db, p.id, payout);
    settledCount += 1;
  }

  return { settledCount, totalPayout };
}
