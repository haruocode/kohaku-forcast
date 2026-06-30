// ベット（賭け）型ポイントの配当ロジック（DB非依存の純粋関数）。
// 仕様: 残高を賭けて予想し、的中で配当、外れは没収。
// - 外れ（予想アーティストが未出場 or 発表後の不正投稿）→ 配当 0（賭け額は没収）
// - 出場のみ的中 → 賭け額 × 2（儲け＝賭け額と同額）
// - 出場＋曲も的中 → 賭け額 × 4（儲け＝賭け額の3倍）
// - 早押しボーナス: 儲け分のみ最速で最大 ×1.5 まで増える（賭け額の払い戻しには掛けない）
//
// 採点の「早さ係数」「不正投票判定」は scoring.ts と共有する。

import {
  earlinessFactor,
  earlyBirdMultiplier,
  isScorable,
  EARLY_BIRD_MAX_BONUS,
  type ResultInput,
  type SeasonWindow,
} from "./scoring";

/** 出場のみ的中の配当倍率（賭け額に対する総受取） */
export const ARTIST_HIT_MULTIPLIER = 2;
/** 出場＋曲も的中の配当倍率 */
export const SONG_HIT_MULTIPLIER = 4;

export type SettleInput = {
  /** 賭け額（正の整数） */
  stake: number;
  /** 予想した曲。出場予想のみなら null */
  predictedSongId: string | null;
  /** 最後に内容を変えた時刻（早押し・有効性の判定に使う） */
  updatedAt: string;
};

/** 賭け額に対する基礎配当倍率を返す（早押し適用前。外れは 0）。 */
function baseMultiplier(
  prediction: SettleInput,
  result: ResultInput,
): number {
  if (!result || !result.appeared) return 0;
  if (
    prediction.predictedSongId !== null &&
    prediction.predictedSongId === result.actualSongId
  ) {
    return SONG_HIT_MULTIPLIER;
  }
  return ARTIST_HIT_MULTIPLIER;
}

/**
 * 予想1件の配当（受取ポイント。整数）を返す。
 * - 不正投票（発表後の投稿・編集）／外れ → 0（賭け額は戻らない）
 * - 的中 → 賭け額 + 儲け×早押し倍率。儲け = stake×(倍率-1)。
 * 純損益は payout - stake で、外れは -stake、的中は正。
 */
export function settlePayout(
  prediction: SettleInput,
  result: ResultInput,
  window: SeasonWindow,
  maxBonus: number = EARLY_BIRD_MAX_BONUS,
): number {
  if (!isScorable(prediction, window)) return 0;
  const m = baseMultiplier(prediction, result);
  if (m === 0) return 0;
  const profit = prediction.stake * (m - 1);
  const e = earlinessFactor(prediction.updatedAt, window);
  const boostedProfit = profit * earlyBirdMultiplier(e, maxBonus);
  return Math.round(prediction.stake + boostedProfit);
}
