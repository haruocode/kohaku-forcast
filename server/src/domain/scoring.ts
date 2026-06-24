// 予想の採点ロジック（DB非依存の純粋関数）。
// 仕様は AGENTS.md「スコアリングのアイデア」「早押しボーナス」「予想の受付ルール」に対応。

/** アーティスト的中（出場を当てた）の基礎点 */
export const ARTIST_POINTS = 10;
/** 曲的中の基礎点（アーティストも的中している場合のみ加算） */
export const SONG_POINTS = 20;
/** 早押し最大ボーナス（最速の的中が基礎点の最大 1 + この値 倍になる） */
export const EARLY_BIRD_MAX_BONUS = 0.5;

/** 採点対象の予想（必要な項目のみ） */
export type PredictionInput = {
  /** 予想した曲。出場予想のみ（曲を予想しない）の場合は null */
  predictedSongId: string | null;
  /** 最後に内容を変えた時刻（ISO8601 / UTC）。早さ・有効性はこの時刻で測る */
  updatedAt: string;
};

/**
 * 予想したアーティストの公式結果。
 * null は「そのアーティストの結果が無い＝出場しなかった」とみなす。
 */
export type ResultInput = {
  appeared: boolean;
  /** 実際に歌った曲。未出場・曲不明なら null */
  actualSongId: string | null;
} | null;

/** シーズンの受付期間。採点時には締切（公式発表時刻）が確定している前提 */
export type SeasonWindow = {
  /** 受付開始（ISO8601 / UTC） */
  openAt: string;
  /** 締切＝公式発表の時刻（ISO8601 / UTC） */
  closeAt: string;
};

const toMs = (iso: string): number => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO8601 date: ${iso}`);
  return ms;
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * 基礎点を返す（早押しボーナス適用前）。
 * - 未出場 → 0
 * - 出場 → +10、さらに曲も一致していれば +20（合算）
 */
export function baseScore(
  prediction: PredictionInput,
  result: ResultInput,
): number {
  if (!result || !result.appeared) return 0;

  let score = ARTIST_POINTS;
  if (
    prediction.predictedSongId !== null &&
    prediction.predictedSongId === result.actualSongId
  ) {
    score += SONG_POINTS;
  }
  return score;
}

/**
 * 早さ係数 e を返す（1 = 最速 / 0 = 締切間際）。
 * p = (updatedAt - openAt) / (closeAt - openAt) を [0,1] にクランプし、e = 1 - p。
 */
export function earlinessFactor(
  updatedAt: string,
  window: SeasonWindow,
): number {
  const open = toMs(window.openAt);
  const close = toMs(window.closeAt);
  const span = close - open;
  if (span <= 0) return 0; // 退化したウィンドウはボーナスなし
  const p = clamp01((toMs(updatedAt) - open) / span);
  return 1 - p;
}

/** 早押し倍率（1 + 最大ボーナス × 早さ係数） */
export function earlyBirdMultiplier(
  factor: number,
  maxBonus: number = EARLY_BIRD_MAX_BONUS,
): number {
  return 1 + maxBonus * clamp01(factor);
}

/**
 * 採点対象か（不正投票でないか）を判定する。
 * 公式発表の時刻以降に投稿・編集された予想は無効（updatedAt < closeAt のみ有効）。
 */
export function isScorable(
  prediction: PredictionInput,
  window: SeasonWindow,
): boolean {
  return toMs(prediction.updatedAt) < toMs(window.closeAt);
}

/**
 * 予想1件の最終点（小数）を返す。
 * 不正投票（発表後の投稿・編集）は採点対象外で常に 0。
 * 表示時は displayScore() で整数に四捨五入する。
 */
export function scorePrediction(
  prediction: PredictionInput,
  result: ResultInput,
  window: SeasonWindow,
  maxBonus: number = EARLY_BIRD_MAX_BONUS,
): number {
  if (!isScorable(prediction, window)) return 0;
  const base = baseScore(prediction, result);
  if (base === 0) return 0;
  const e = earlinessFactor(prediction.updatedAt, window);
  return base * earlyBirdMultiplier(e, maxBonus);
}

/** 内部の小数スコアを表示用の整数へ四捨五入する */
export function displayScore(score: number): number {
  return Math.round(score);
}
