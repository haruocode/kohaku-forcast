import { describe, it, expect } from "vitest";
import { computeAwards } from "./distribution";
import type { RankablePrediction, ResultsByArtist } from "./ranking";
import type { SeasonWindow } from "./scoring";

const window: SeasonWindow = {
  openAt: "2026-11-01T00:00:00.000Z",
  closeAt: "2026-12-01T00:00:00.000Z",
};
const late = "2026-11-30T23:00:00.000Z"; // 早押しの影響を排除

const pred = (
  userId: string,
  artistId: string,
  songId: string | null,
): RankablePrediction => ({
  userId,
  artistId,
  predictedSongId: songId,
  createdAt: late,
  updatedAt: late,
});

const results: ResultsByArtist = new Map([
  ["a1", { appeared: true, actualSongId: "s1" }],
  ["a2", { appeared: false, actualSongId: null }],
]);

describe("computeAwards", () => {
  it("配布量はスコアと一致する", () => {
    const awards = computeAwards(
      [pred("u1", "a1", "s1"), pred("u2", "a1", null)],
      results,
      window,
    );
    const byUser = Object.fromEntries(awards.map((a) => [a.userId, a.amount]));
    expect(byUser).toEqual({ u1: 30, u2: 10 });
  });

  it("スコア0（外れ）の人は対象外", () => {
    const awards = computeAwards([pred("u3", "a2", null)], results, window);
    expect(awards).toEqual([]);
  });
});
