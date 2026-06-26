// 記念トークンの配布量算出（DB非依存）。
// AGENTS.md「記念トークン」: 配布量は的中スコアに連動。スコアをそのまま枚数にする。

import { displayScore, type SeasonWindow } from "./scoring";
import {
  computeRanking,
  type RankablePrediction,
  type ResultsByArtist,
} from "./ranking";

export type Award = { userId: string; amount: number };

/**
 * 各ユーザーの配布量を返す。
 * 量 = そのシーズンの合計スコア（整数）。スコア0の人は対象外。
 */
export function computeAwards(
  predictions: readonly RankablePrediction[],
  results: ResultsByArtist,
  window: SeasonWindow,
  maxBonus?: number,
): Award[] {
  return computeRanking(predictions, results, window, maxBonus)
    .map((e) => ({ userId: e.userId, amount: displayScore(e.totalScore) }))
    .filter((a) => a.amount > 0);
}
