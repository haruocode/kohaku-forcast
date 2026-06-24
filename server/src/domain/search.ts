// 検索の正規化（DB非依存）。AGENTS.md「検索要件」に対応。
// あいまい（類似度）検索は持たず、表記揺れだけ吸収した部分一致を提供する。

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const KANA_OFFSET = 0x60; // カタカナ → ひらがな

/**
 * 検索用にテキストを正規化する:
 * - NFKC（全角/半角の統一・合成）
 * - 小文字化（英字の大小無視）
 * - カタカナ → ひらがな（かな表記の違いを吸収）
 * - 空白の除去
 */
export function normalizeForSearch(input: string): string {
  const nfkc = input.normalize("NFKC").toLowerCase();
  let out = "";
  for (const ch of nfkc) {
    const code = ch.charCodeAt(0);
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      out += String.fromCharCode(code - KANA_OFFSET);
    } else {
      out += ch;
    }
  }
  return out.replace(/\s+/g, "");
}

/**
 * needle が haystack に（正規化後の）部分一致で含まれるか。
 * 空のクエリは何にもマッチさせない。
 */
export function matchesQuery(haystack: string, needle: string): boolean {
  const n = normalizeForSearch(needle);
  if (n === "") return false;
  return normalizeForSearch(haystack).includes(n);
}

/** 複数の候補テキストのいずれかにマッチするか */
export function matchesAny(haystacks: readonly string[], needle: string): boolean {
  return haystacks.some((h) => matchesQuery(h, needle));
}
