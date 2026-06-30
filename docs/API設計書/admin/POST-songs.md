# POST /api/admin/songs

## 概要

曲を手動登録する。既存のローカルアーティスト配下に作成する。

## 認可

要管理者（`requireAdmin`）。

## リクエスト

ボディ（JSON）。Zod `createSongSchema`。

| フィールド  | 型     | 必須 | 制約                      |
| ----------- | ------ | ---- | ------------------------- |
| artistId    | string | 必須 | 既存の `artists.id`       |
| title       | string | 必須 | 1文字以上                 |
| titleKana   | string | 任意 | 1文字以上。かな違い検索用 |
| releaseYear | number | 任意 | 整数 1900〜2100           |

```json
{
  "artistId": "uuid",
  "title": "Lemon",
  "titleKana": "れもん",
  "releaseYear": 2018
}
```

## レスポンス

`201 Created` … 作成された song。

## エラー

| HTTP | code               | 条件                                  |
| ---- | ------------------ | ------------------------------------- |
| 400  | `VALIDATION_ERROR` | スキーマ不一致                        |
| 403  | `FORBIDDEN`        | 非管理者                              |
| 404  | `NOT_FOUND`        | `artistId` のアーティストが存在しない |

## 処理仕様

- 作成前に `findArtistById` でアーティスト存在を確認（無ければ 404）。
- 手動登録曲は `(source, external_id)` がともに NULL。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/schemas/admin.ts](../../../server/src/schemas/admin.ts) … `createSongSchema`
- [server/src/repositories/songs.ts](../../../server/src/repositories/songs.ts) … `createSong`
