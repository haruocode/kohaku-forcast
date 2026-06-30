# POST /api/admin/results

## 概要

公式結果を確定する。シーズンの各アーティストの出場可否と歌唱曲をまとめて upsert する。冪等。

## 認可

要管理者（`requireAdmin`）。

## リクエスト

ボディ（JSON）。Zod `confirmResultsSchema`。

| フィールド | 型     | 必須 | 制約      |
| ---------- | ------ | ---- | --------- |
| seasonId   | string | 必須 | 1文字以上 |
| entries    | array  | 必須 | 1件以上   |

`entries[]`:

| フィールド | 型             | 必須 | 説明                                                |
| ---------- | -------------- | ---- | --------------------------------------------------- |
| artistId   | string         | 必須 | ローカル `artists.id`                               |
| appeared   | boolean        | 必須 | 出場したか                                          |
| songId     | string \| null | 任意 | 歌唱曲。`appeared=false` のときは無視され NULL 保存 |

```json
{
  "seasonId": "uuid",
  "entries": [
    { "artistId": "a1", "appeared": true, "songId": "s1" },
    { "artistId": "a2", "appeared": false }
  ]
}
```

## レスポンス

`200 OK`

```json
{ "ok": true, "count": 2 }
```

## エラー

| HTTP | code               | 条件                          |
| ---- | ------------------ | ----------------------------- |
| 400  | `VALIDATION_ERROR` | スキーマ不一致 / entries が空 |
| 403  | `FORBIDDEN`        | 非管理者                      |
| 404  | `NOT_FOUND`        | シーズンが存在しない          |

## 処理仕様（冪等性）

- 各 entry を `(season_id, artist_id)` をキーに upsert（`onConflictDoUpdate`）。
  同じ結果を再送・内容変更しても行は重複せず更新される。
- `appeared=false` のとき `songId` は強制的に NULL（未出場の曲は持たない）。
- `results` は「事実」のみ保持し点数は持たない。点数は予想×結果の突合で算出（ランキング/配布時）。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/schemas/admin.ts](../../../server/src/schemas/admin.ts) … `confirmResultsSchema`
- [server/src/repositories/results.ts](../../../server/src/repositories/results.ts) … `upsertResults`
