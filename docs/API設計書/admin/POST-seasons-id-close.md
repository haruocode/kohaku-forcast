# POST /api/admin/seasons/:id/close

## 概要

締切操作。シーズンの `prediction_close_at` に「公式発表の日時」を設定する。これ以降の投稿・編集・取消は拒否される。

## 認可

要管理者（`requireAdmin`）。

## リクエスト

パスパラメータ:

| 名前 | 型     | 説明       |
| ---- | ------ | ---------- |
| id   | string | シーズンID |

ボディ（JSON）。Zod `closeSeasonSchema`。

| フィールド  | 型     | 必須 | 制約                                                           |
| ----------- | ------ | ---- | -------------------------------------------------------------- |
| announcedAt | string | 必須 | ISO8601 日時。**操作時点より過去でも可**（現実の発表時刻が正） |

```json
{ "announcedAt": "2026-11-20T09:00:00Z" }
```

## レスポンス

`200 OK` … 更新後の season（`predictionCloseAt` が設定される）。

## エラー

| HTTP | code               | 条件                           |
| ---- | ------------------ | ------------------------------ |
| 400  | `VALIDATION_ERROR` | `announcedAt` が日時形式でない |
| 403  | `FORBIDDEN`        | 非管理者                       |
| 404  | `NOT_FOUND`        | シーズンが存在しない           |

## 処理仕様

- 紅白の公式発表日時は事前に確定できないため、締切は後から運営が設定する設計。
- 過去日時を設定できるのは、現実の発表時刻を正にするため。
- 採点では `predictions.updated_at < announcedAt` の予想のみ有効。発表時刻以降の投稿・編集は
  たとえこの締切操作より前でも不正投票として除外される（採点ロジック側で判定）。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/schemas/admin.ts](../../../server/src/schemas/admin.ts) … `closeSeasonSchema`
- [server/src/repositories/seasons.ts](../../../server/src/repositories/seasons.ts) … `closeSeason`
