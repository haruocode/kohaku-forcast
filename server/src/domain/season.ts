// シーズンの受付判定（DB非依存）。AGENTS.md「予想の受付ルール」に対応。

export type SeasonTiming = {
  /** 締切＝公式発表の時刻（ISO8601）。NULL は受付中を意味する */
  predictionCloseAt: string | null;
};

/**
 * 予想を受け付けてよいか。
 * close_at が未設定（NULL）か、現在が close_at より前なら受付中。
 */
export function isAcceptingPredictions(
  season: SeasonTiming,
  now: Date = new Date(),
): boolean {
  if (season.predictionCloseAt === null) return true;
  return now.getTime() < Date.parse(season.predictionCloseAt);
}
