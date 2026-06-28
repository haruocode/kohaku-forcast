import { describe, it, expect } from "vitest";
import {
  baseScore,
  earlinessFactor,
  earlyBirdMultiplier,
  isScorable,
  scorePrediction,
  displayScore,
  EARLY_BIRD_MAX_BONUS,
  type SeasonWindow,
  type PredictionInput,
} from "./scoring";

// 30日間の受付期間（早押し係数の計算用）
const window: SeasonWindow = {
  openAt: "2026-11-01T00:00:00.000Z",
  closeAt: "2026-12-01T00:00:00.000Z",
};
const openAt = window.openAt;
const midAt = "2026-11-16T00:00:00.000Z"; // ちょうど中間（e=0.5）
const afterCloseAt = "2026-12-02T00:00:00.000Z"; // 締切後

const at = (updatedAt: string): PredictionInput => ({
  predictedSongId: "song-1",
  updatedAt,
});

describe("baseScore（基礎点 / 早押し適用前）", () => {
  it("出場○・曲○ → 30（10 + 20）", () => {
    expect(
      baseScore(
        { predictedSongId: "song-1", updatedAt: openAt },
        { appeared: true, actualSongId: "song-1" },
      ),
    ).toBe(30);
  });

  it("出場○・曲✗ → 10", () => {
    expect(
      baseScore(
        { predictedSongId: "song-1", updatedAt: openAt },
        { appeared: true, actualSongId: "song-2" },
      ),
    ).toBe(10);
  });

  it("出場✗ → 0", () => {
    expect(
      baseScore(
        { predictedSongId: "song-1", updatedAt: openAt },
        { appeared: false, actualSongId: null },
      ),
    ).toBe(0);
  });

  it("出場予想のみ（曲なし）・出場○ → 10", () => {
    expect(
      baseScore(
        { predictedSongId: null, updatedAt: openAt },
        { appeared: true, actualSongId: "song-1" },
      ),
    ).toBe(10);
  });

  it("出場予想のみ（曲なし）・出場✗ → 0", () => {
    expect(
      baseScore(
        { predictedSongId: null, updatedAt: openAt },
        { appeared: false, actualSongId: null },
      ),
    ).toBe(0);
  });

  it("結果が無い（null）→ 0（未出場扱い）", () => {
    expect(
      baseScore({ predictedSongId: "song-1", updatedAt: openAt }, null),
    ).toBe(0);
  });
});

describe("earlinessFactor（早さ係数 e）", () => {
  it("最速（openAtちょうど）→ 1", () => {
    expect(earlinessFactor(openAt, window)).toBe(1);
  });

  it("中間 → 0.5", () => {
    expect(earlinessFactor(midAt, window)).toBeCloseTo(0.5, 5);
  });

  it("締切ちょうど → 0", () => {
    expect(earlinessFactor(window.closeAt, window)).toBe(0);
  });

  it("受付開始より前 → 1 にクランプ", () => {
    expect(earlinessFactor("2026-10-01T00:00:00.000Z", window)).toBe(1);
  });

  it("退化したウィンドウ（open >= close）→ 0", () => {
    expect(
      earlinessFactor(openAt, { openAt, closeAt: openAt }),
    ).toBe(0);
  });
});

describe("earlyBirdMultiplier（早押し倍率）", () => {
  it("e=1 → 1.5倍", () => {
    expect(earlyBirdMultiplier(1)).toBe(1.5);
  });
  it("e=0 → 1.0倍", () => {
    expect(earlyBirdMultiplier(0)).toBe(1);
  });
  it("e=0.5 → 1.25倍", () => {
    expect(earlyBirdMultiplier(0.5)).toBe(1.25);
  });
});

describe("isScorable（不正投票判定）", () => {
  it("締切より前の更新 → 有効", () => {
    expect(isScorable(at(midAt), window)).toBe(true);
  });
  it("締切ちょうどの更新 → 無効", () => {
    expect(isScorable(at(window.closeAt), window)).toBe(false);
  });
  it("締切後の更新 → 無効", () => {
    expect(isScorable(at(afterCloseAt), window)).toBe(false);
  });
});

describe("scorePrediction（最終点 / 早押し込み）", () => {
  const matched = { appeared: true, actualSongId: "song-1" } as const;

  it("最速・両的中 → 30 × 1.5 = 45", () => {
    expect(scorePrediction(at(openAt), matched, window)).toBe(45);
  });

  it("中間・両的中 → 30 × 1.25 = 37.5", () => {
    expect(scorePrediction(at(midAt), matched, window)).toBeCloseTo(37.5, 5);
  });

  it("最速・出場のみ的中（曲なし）→ 10 × 1.5 = 15", () => {
    expect(
      scorePrediction(
        { predictedSongId: null, updatedAt: openAt },
        matched,
        window,
      ),
    ).toBe(15);
  });

  it("外れ（未出場）→ -10（減点）", () => {
    expect(
      scorePrediction(at(openAt), { appeared: false, actualSongId: null }, window),
    ).toBe(-10);
  });

  it("外れの減点は早押し倍率の影響を受けずフラット（最速でも -10）", () => {
    const miss = { appeared: false, actualSongId: null } as const;
    expect(scorePrediction(at(openAt), miss, window)).toBe(-10);
    expect(scorePrediction(at(midAt), miss, window)).toBe(-10);
  });

  it("結果なし（null）も未出場扱いで -10", () => {
    expect(scorePrediction(at(openAt), null, window)).toBe(-10);
  });

  it("出場はしたが曲が外れ → 減点なし（+10 を維持）", () => {
    expect(
      scorePrediction(at(midAt), { appeared: true, actualSongId: "song-2" }, window),
    ).toBeCloseTo(12.5, 5); // 10 × 1.25
  });

  it("締切後の投稿は的中でも 0（不正投票・外れでも減点しない）", () => {
    expect(scorePrediction(at(afterCloseAt), matched, window)).toBe(0);
    expect(
      scorePrediction(
        at(afterCloseAt),
        { appeared: false, actualSongId: null },
        window,
      ),
    ).toBe(0);
  });

  it("missPenalty は引数で上書きできる", () => {
    expect(
      scorePrediction(
        at(openAt),
        { appeared: false, actualSongId: null },
        window,
        EARLY_BIRD_MAX_BONUS,
        5,
      ),
    ).toBe(-5);
  });
});

describe("displayScore（表示用の四捨五入）", () => {
  it("37.5 → 38", () => {
    expect(displayScore(37.5)).toBe(38);
  });
  it("37.4 → 37", () => {
    expect(displayScore(37.4)).toBe(37);
  });
  it("45 → 45", () => {
    expect(displayScore(45)).toBe(45);
  });
});
