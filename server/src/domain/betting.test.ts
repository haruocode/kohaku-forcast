import { describe, it, expect } from "vitest";
import { settlePayout } from "./betting";
import type { ResultInput, SeasonWindow } from "./scoring";

const window: SeasonWindow = {
  openAt: "2026-11-01T00:00:00.000Z",
  closeAt: "2026-12-01T00:00:00.000Z",
};
// 締切間際（早押しボーナスをほぼ無効化して基礎倍率だけ見る）
const late = "2026-11-30T23:59:59.000Z";

const appeared = (songId: string | null): ResultInput => ({
  appeared: true,
  actualSongId: songId,
});

describe("settlePayout", () => {
  it("外れ（未出場）は配当0（賭け額は没収）", () => {
    const payout = settlePayout(
      { stake: 100, predictedSongId: null, updatedAt: late },
      null,
      window,
    );
    expect(payout).toBe(0);
  });

  it("出場のみ的中は賭け額×2", () => {
    const payout = settlePayout(
      { stake: 100, predictedSongId: null, updatedAt: late },
      appeared("song-x"),
      window,
    );
    expect(payout).toBe(200);
  });

  it("曲を外しても出場が当たれば×2", () => {
    const payout = settlePayout(
      { stake: 100, predictedSongId: "song-a", updatedAt: late },
      appeared("song-b"),
      window,
    );
    expect(payout).toBe(200);
  });

  it("出場＋曲も的中は賭け額×4", () => {
    const payout = settlePayout(
      { stake: 100, predictedSongId: "song-a", updatedAt: late },
      appeared("song-a"),
      window,
    );
    expect(payout).toBe(400);
  });

  it("最速の的中は儲け分が×1.5（出場のみ: 100→ +100×1.5=250）", () => {
    const payout = settlePayout(
      { stake: 100, predictedSongId: null, updatedAt: window.openAt },
      appeared("song-x"),
      window,
    );
    // payout = stake(100) + profit(100)×1.5 = 250
    expect(payout).toBe(250);
  });

  it("発表後に編集された不正投票は配当0", () => {
    const afterClose = "2026-12-02T00:00:00.000Z";
    const payout = settlePayout(
      { stake: 100, predictedSongId: "song-a", updatedAt: afterClose },
      appeared("song-a"),
      window,
    );
    expect(payout).toBe(0);
  });
});
