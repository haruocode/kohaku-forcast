import { describe, it, expect } from "vitest";
import { normalizeForSearch, matchesQuery, matchesAny } from "./search";

describe("normalizeForSearch", () => {
  it("カタカナをひらがなに統一する", () => {
    expect(normalizeForSearch("ヨネヅ")).toBe("よねづ");
  });
  it("全角英数を半角・小文字に統一する", () => {
    expect(normalizeForSearch("ＡＫＢ４８")).toBe("akb48");
  });
  it("空白を除去する", () => {
    expect(normalizeForSearch("back number")).toBe("backnumber");
  });
});

describe("matchesQuery", () => {
  it("漢字の部分一致", () => {
    expect(matchesQuery("米津玄師", "米津")).toBe(true);
  });
  it("かな違い（カタカナ入力でひらがな対象）", () => {
    expect(matchesQuery("よねづけんし", "ヨネヅ")).toBe(true);
  });
  it("英字の大小を無視", () => {
    expect(matchesQuery("Kenshi Yonezu", "kenshi")).toBe(true);
  });
  it("一致しない", () => {
    expect(matchesQuery("米津玄師", "宇多田")).toBe(false);
  });
  it("空クエリは何にもマッチしない", () => {
    expect(matchesQuery("米津玄師", "   ")).toBe(false);
  });
});

describe("matchesAny", () => {
  it("別名のいずれかにマッチ", () => {
    expect(matchesAny(["米津玄師", "ハチ", "Kenshi Yonezu"], "はち")).toBe(true);
  });
  it("どれにもマッチしない", () => {
    expect(matchesAny(["米津玄師", "ハチ"], "あいみょん")).toBe(false);
  });
});
