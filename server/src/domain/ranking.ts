// ランキング集計（DB非依存）。AGENTS.md「ランキング」に対応。
// 並び順: 合計スコア降順 → 的中件数降順 → 最初の予想投稿が早い順。

import {
  scorePrediction,
  EARLY_BIRD_MAX_BONUS,
  MISS_PENALTY,
  type SeasonWindow,
  type ResultInput,
} from "./scoring";

export type RankablePrediction = {
  userId: string;
  artistId: string;
  predictedSongId: string | null;
  /** 最初の予想投稿の早さ比較に使う */
  createdAt: string;
  /** 早押し係数・有効性の判定に使う */
  updatedAt: string;
};

export type ResultsByArtist = Map<string, { appeared: boolean; actualSongId: string | null }>;

export type RankEntry = {
  rank: number;
  userId: string;
  /** 合計スコア（小数。表示時に四捨五入する） */
  totalScore: number;
  /** スコアが付いた（的中した）予想の件数 */
  hitCount: number;
  /** 最初の予想投稿時刻（タイブレーク用） */
  earliestAt: string;
};

type Acc = { userId: string; totalScore: number; hitCount: number; earliestAt: string };

/**
 * ユーザー集計を並べて順位を振る（DB非依存）。
 * 並び順: 合計スコア降順 → 的中件数降順 → 最初の予想投稿が早い順。
 * 競技順位法: スコアと的中件数が同じなら同順位（時刻は表示順のみ）。
 */
function rankAccumulators(accs: readonly Acc[]): RankEntry[] {
  const sorted = [...accs].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
    return a.earliestAt < b.earliestAt ? -1 : a.earliestAt > b.earliestAt ? 1 : 0;
  });

  const entries: RankEntry[] = [];
  sorted.forEach((acc, i) => {
    const prev = sorted[i - 1];
    const tied =
      prev !== undefined &&
      prev.totalScore === acc.totalScore &&
      prev.hitCount === acc.hitCount;
    const rank = tied ? entries[i - 1]!.rank : i + 1;
    entries.push({
      rank,
      userId: acc.userId,
      totalScore: acc.totalScore,
      hitCount: acc.hitCount,
      earliestAt: acc.earliestAt,
    });
  });

  return entries;
}

export function computeRanking(
  predictions: readonly RankablePrediction[],
  results: ResultsByArtist,
  window: SeasonWindow,
  maxBonus: number = EARLY_BIRD_MAX_BONUS,
  missPenalty: number = MISS_PENALTY,
): RankEntry[] {
  const byUser = new Map<string, Acc>();

  for (const p of predictions) {
    const result: ResultInput = results.get(p.artistId) ?? null;
    const score = scorePrediction(
      { predictedSongId: p.predictedSongId, updatedAt: p.updatedAt },
      result,
      window,
      maxBonus,
      missPenalty,
    );

    const acc =
      byUser.get(p.userId) ??
      { userId: p.userId, totalScore: 0, hitCount: 0, earliestAt: p.createdAt };
    acc.totalScore += score;
    if (score > 0) acc.hitCount += 1;
    if (p.createdAt < acc.earliestAt) acc.earliestAt = p.createdAt;
    byUser.set(p.userId, acc);
  }

  return rankAccumulators([...byUser.values()]);
}

/**
 * 複数シーズンのランキングを合算して通算ランキングを作る（DB非依存）。
 * - 通算スコア = 各シーズンの totalScore の合計（マイナスも許容）
 * - 的中件数 = 各シーズンの hitCount の合計
 * - earliestAt = 全シーズンを通じた最初の予想投稿時刻
 * 並び順・同順位ルールはシーズン版と同じ。
 */
export function combineRankings(
  seasonRankings: readonly (readonly RankEntry[])[],
): RankEntry[] {
  const byUser = new Map<string, Acc>();

  for (const ranking of seasonRankings) {
    for (const e of ranking) {
      const acc =
        byUser.get(e.userId) ??
        { userId: e.userId, totalScore: 0, hitCount: 0, earliestAt: e.earliestAt };
      acc.totalScore += e.totalScore;
      acc.hitCount += e.hitCount;
      if (e.earliestAt < acc.earliestAt) acc.earliestAt = e.earliestAt;
      byUser.set(e.userId, acc);
    }
  }

  return rankAccumulators([...byUser.values()]);
}
