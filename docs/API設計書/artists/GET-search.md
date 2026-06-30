# GET /api/artists/search

## 概要

ローカルDBのアーティストを部分一致で検索する。`name` / `name_kana` / 別名（`artist_aliases`）が対象。

## 認可

公開（認証不要）。

## リクエスト

クエリパラメータ:

| 名前  | 型     | 必須 | 既定 | 説明                         |
| ----- | ------ | ---- | ---- | ---------------------------- |
| q     | string | 必須 | －   | 検索語（trim後に空なら 400） |
| limit | number | 任意 | 20   | 最大 50。範囲外・不正は 20   |

## レスポンス

`200 OK` … 別名配列付き Artist の配列。

```json
[
  {
    "id": "uuid",
    "name": "米津玄師",
    "nameKana": "よねづけんし",
    "aliases": ["ハチ", "Kenshi Yonezu"],
    "source": null,
    "externalId": null,
    "imageUrl": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

## エラー

| HTTP | code               | 条件     |
| ---- | ------------------ | -------- |
| 400  | `VALIDATION_ERROR` | `q` が空 |

## 例

```bash
curl -s 'http://localhost:8787/api/artists/search?q=ヨネヅ'
```

## 処理仕様（検索の正規化）

- クエリ・対象とも **NFKC正規化 → 小文字化 → カタカナ→ひらがな → 空白除去** してから部分一致。
  - 例: `ヨネヅ`・`ＡＩＭＹＯＮ`・`はち`・`kenshi` などの表記揺れを吸収。
- 類似度・タイプミス補正は行わない（割り切り）。
- D1 に類似検索が無いため、候補を読み込みアプリ側で照合する（紅白規模の小データ前提）。

## 実装

- [server/src/routes/artists.ts](../../../server/src/routes/artists.ts)
- [server/src/services/search.ts](../../../server/src/services/search.ts) … `searchArtists`, `clampLimit`
- [server/src/domain/search.ts](../../../server/src/domain/search.ts) … `normalizeForSearch`, `matchesQuery`
