import { describe, it, expect } from "vitest";
import { isAcceptingPredictions } from "./season";

const now = new Date("2026-12-15T00:00:00.000Z");

describe("isAcceptingPredictions", () => {
  it("close_at が NULL なら受付中", () => {
    expect(isAcceptingPredictions({ predictionCloseAt: null }, now)).toBe(true);
  });

  it("現在が close_at より前なら受付中", () => {
    expect(
      isAcceptingPredictions(
        { predictionCloseAt: "2026-12-31T12:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("現在が close_at 以降なら締切", () => {
    expect(
      isAcceptingPredictions(
        { predictionCloseAt: "2026-12-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("close_at ちょうどは締切（境界）", () => {
    expect(
      isAcceptingPredictions(
        { predictionCloseAt: "2026-12-15T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });
});
