import { describe, it, expect } from "vitest";
import {
  computeRanking,
  combineRankings,
  type RankablePrediction,
  type RankEntry,
  type ResultsByArtist,
} from "./ranking";
import type { SeasonWindow } from "./scoring";

const window: SeasonWindow = {
  openAt: "2026-11-01T00:00:00.000Z",
  closeAt: "2026-12-01T00:00:00.000Z",
};

// 早押しの影響を消すため、全予想を締切間際（e≒0, 倍率≒1.0）に置く
const lateAt = "2026-11-30T23:00:00.000Z";

const pred = (
  userId: string,
  artistId: string,
  songId: string | null,
  createdAt = lateAt,
): RankablePrediction => ({
  userId,
  artistId,
  predictedSongId: songId,
  createdAt,
  updatedAt: createdAt,
});

const results: ResultsByArtist = new Map([
  ["a1", { appeared: true, actualSongId: "s1" }],
  ["a2", { appeared: false, actualSongId: null }],
]);

describe("computeRanking", () => {
  it("合計スコアの高い順に並ぶ", () => {
    // u1: 両的中 ≒30 / u2: 出場のみ的中 ≒10
    const entries = computeRanking(
      [pred("u1", "a1", "s1"), pred("u2", "a1", "wrong-song")],
      results,
      window,
    );
    expect(entries.map((e) => e.userId)).toEqual(["u1", "u2"]);
    expect(Math.round(entries[0]!.totalScore)).toBe(30);
    expect(Math.round(entries[1]!.totalScore)).toBe(10);
    expect(entries[0]!.rank).toBe(1);
    expect(entries[1]!.rank).toBe(2);
  });

  it("外れ予想は減点（-10）・的中件数には含めない", () => {
    const entries = computeRanking([pred("u1", "a2", null)], results, window);
    expect(entries[0]!.totalScore).toBe(-10);
    expect(entries[0]!.hitCount).toBe(0);
  });

  it("撒き得を防ぐ: 的中1件でも外れを多く撒くと合計はマイナスになりうる", () => {
    // a1 的中(+30) を1件 / a2 外れ(-10) を3件 → 30 - 30 = 0、さらに外れが増えれば負に
    const entries = computeRanking(
      [
        pred("spammer", "a1", "s1"),
        pred("spammer", "a2", null),
        pred("spammer", "a2b", null),
        pred("spammer", "a2c", null),
        pred("spammer", "a2d", null),
      ],
      results,
      window,
    );
    // 的中は1件のみ（hitCount=1）、外れ4件で 30 - 40 = -10
    expect(entries[0]!.hitCount).toBe(1);
    expect(Math.round(entries[0]!.totalScore)).toBe(-10);
  });

  it("同点なら的中件数の多い方が上位", () => {
    // u1: a1で両的中(30) / u2: a1出場のみ(10)+別の的中で30 になるよう調整
    // ここでは件数差を作る: u1は1件で30、u2は… 同点30を2件で作る
    const r: ResultsByArtist = new Map([
      ["a1", { appeared: true, actualSongId: "s1" }], // 両的中=30
      ["a3", { appeared: true, actualSongId: "s3" }], // 出場のみ=10
      ["a4", { appeared: true, actualSongId: "s4" }], // 出場のみ=10
      ["a5", { appeared: true, actualSongId: "s5" }], // 出場のみ=10
    ]);
    const entries = computeRanking(
      [
        pred("u1", "a1", "s1"), // 30 を1件
        pred("u2", "a3", null), // 10
        pred("u2", "a4", null), // 10
        pred("u2", "a5", null), // 10 → 合計30を3件
      ],
      r,
      window,
    );
    // 合計は同点(30)、的中件数 u2(3) > u1(1) なので u2 が上位
    expect(entries.map((e) => e.userId)).toEqual(["u2", "u1"]);
  });

  it("合計・件数とも同じなら早い投稿が上位、順位は同値", () => {
    const r: ResultsByArtist = new Map([
      ["a1", { appeared: true, actualSongId: "s1" }],
    ]);
    // スコアを揃えるため updatedAt（早押し係数の基準）は同一にし、
    // createdAt（最初の投稿）だけずらす
    const entries = computeRanking(
      [
        {
          userId: "late",
          artistId: "a1",
          predictedSongId: "s1",
          createdAt: "2026-11-30T23:30:00.000Z",
          updatedAt: lateAt,
        },
        {
          userId: "early",
          artistId: "a1",
          predictedSongId: "s1",
          createdAt: "2026-11-30T22:00:00.000Z",
          updatedAt: lateAt,
        },
      ],
      r,
      window,
    );
    expect(entries.map((e) => e.userId)).toEqual(["early", "late"]);
    // スコア・件数が同じなので順位は同値（競技順位法）
    expect(entries[0]!.rank).toBe(1);
    expect(entries[1]!.rank).toBe(1);
  });

  it("早押し: 同じ的中でも早い方が高スコア", () => {
    const r: ResultsByArtist = new Map([
      ["a1", { appeared: true, actualSongId: "s1" }],
    ]);
    const entries = computeRanking(
      [
        pred("early", "a1", "s1", "2026-11-01T00:00:00.000Z"), // 最速 30×1.5=45
        pred("late", "a1", "s1", "2026-11-30T23:00:00.000Z"), // 締切間際 ≒30
      ],
      r,
      window,
    );
    expect(entries[0]!.userId).toBe("early");
    expect(Math.round(entries[0]!.totalScore)).toBe(45);
  });
});

describe("combineRankings", () => {
  const entry = (
    userId: string,
    totalScore: number,
    hitCount: number,
    earliestAt: string,
  ): RankEntry => ({ rank: 0, userId, totalScore, hitCount, earliestAt });

  it("複数シーズンのスコア・的中件数を合算し、最も早い投稿を残す", () => {
    const overall = combineRankings([
      // 2025
      [entry("u1", 30, 1, "2025-11-10T00:00:00.000Z")],
      // 2026
      [
        entry("u1", 10, 1, "2026-11-05T00:00:00.000Z"),
        entry("u2", 50, 2, "2026-11-02T00:00:00.000Z"),
      ],
    ]);
    const u1 = overall.find((e) => e.userId === "u1")!;
    const u2 = overall.find((e) => e.userId === "u2")!;
    expect(u1.totalScore).toBe(40);
    expect(u1.hitCount).toBe(2);
    expect(u1.earliestAt).toBe("2025-11-10T00:00:00.000Z");
    // 通算は u2(50) > u1(40)
    expect(overall.map((e) => e.userId)).toEqual(["u2", "u1"]);
    expect(u2.rank).toBe(1);
    expect(u1.rank).toBe(2);
  });

  it("通算スコアはマイナスも許容する", () => {
    const overall = combineRankings([
      [entry("u1", -10, 0, "2025-11-10T00:00:00.000Z")],
      [entry("u1", -20, 0, "2026-11-10T00:00:00.000Z")],
    ]);
    expect(overall[0]!.totalScore).toBe(-30);
  });
});
