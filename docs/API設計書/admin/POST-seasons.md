# POST /api/admin/seasons

## 概要

シーズン（年度）を新規作成する。

## 認可

要管理者（`/api/admin/*` 全体に `requireAdmin`）。非管理者は 403。

## リクエスト

ボディ（JSON）。Zod `createSeasonSchema`。

| フィールド       | 型     | 必須 | 制約                                      |
| ---------------- | ------ | ---- | ----------------------------------------- |
| year             | number | 必須 | 整数 1950〜2100。`seasons.year` は UNIQUE |
| title            | string | 任意 | 1文字以上                                 |
| predictionOpenAt | string | 任意 | ISO8601 日時。早押し係数の基準            |

```json
{ "year": 2027, "title": "第78回", "predictionOpenAt": "2027-11-01T00:00:00Z" }
```

## レスポンス

`201 Created` … 作成された season（`prediction_close_at` は NULL=受付中）。

## エラー

| HTTP | code               | 条件           |
| ---- | ------------------ | -------------- |
| 400  | `VALIDATION_ERROR` | スキーマ不一致 |
| 403  | `FORBIDDEN`        | 非管理者       |

> `year` 重複時は DB の UNIQUE 制約違反になる（事前の専用チェックは無し）。

## 処理仕様

- `predictionOpenAt` を設定しておくと早押しボーナスが有効になる（未設定だと採点時に倍率1.0固定）。
- 締切は作成時点では設定しない。後から [POST /api/admin/seasons/:id/close](./POST-seasons-id-close.md) で設定する。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/schemas/admin.ts](../../../server/src/schemas/admin.ts) … `createSeasonSchema`
- [server/src/repositories/seasons.ts](../../../server/src/repositories/seasons.ts) … `createSeason`
