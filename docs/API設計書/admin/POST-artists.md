# POST /api/admin/artists

## 概要

アーティストを手動登録する。別名（`artist_aliases`）も同時に登録できる。

## 認可

要管理者（`requireAdmin`）。

## リクエスト

ボディ（JSON）。Zod `createArtistSchema`。

| フィールド  | 型       | 必須 | 制約                        |
| ----------- | -------- | ---- | --------------------------- |
| name        | string   | 必須 | 1文字以上                   |
| nameKana    | string   | 任意 | 1文字以上。かな違い検索用   |
| genderGroup | string   | 任意 | 紅組/白組など               |
| officialUrl | string   | 任意 | URL形式                     |
| aliases     | string[] | 任意 | 各1文字以上。別名として登録 |

```json
{
  "name": "米津玄師",
  "nameKana": "よねづけんし",
  "genderGroup": "白",
  "officialUrl": "https://reissuerecords.net/",
  "aliases": ["ハチ", "Kenshi Yonezu"]
}
```

## レスポンス

`201 Created` … 作成された artist（`source`/`externalId` は NULL の手動登録行）。

## エラー

| HTTP | code               | 条件                          |
| ---- | ------------------ | ----------------------------- |
| 400  | `VALIDATION_ERROR` | スキーマ不一致（URL形式など） |
| 403  | `FORBIDDEN`        | 非管理者                      |

## 処理仕様

- `artists` を作成後、`aliases` があれば `artist_aliases` に一括 INSERT。
- 別名は [GET /api/artists/search](../artists/GET-search.md) の検索対象に含まれる。
- 手動登録行は `(source, external_id)` がともに NULL。外部由来行（遅延アップサート）とは別管理。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/schemas/admin.ts](../../../server/src/schemas/admin.ts) … `createArtistSchema`
- [server/src/repositories/artists.ts](../../../server/src/repositories/artists.ts) … `createArtist`
