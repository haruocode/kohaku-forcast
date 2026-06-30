# PUT /api/predictions/:id

## 概要

予想を編集する。受付中かつ本人の予想のみ。アーティスト・シーズンは変更不可。曲・確信度・コメントを更新する。

## 認可

要ログイン（`requireAuth`）＋本人のみ。

## リクエスト

パスパラメータ:

| 名前 | 型     | 説明   |
| ---- | ------ | ------ |
| id   | string | 予想ID |

ボディ（JSON）。Zod `updatePredictionSchema`。**最低1項目が必要**。

| フィールド | 型             | 必須 | 制約・意味                         |
| ---------- | -------------- | ---- | ---------------------------------- |
| song       | object \| null | 任意 | 外部曲。`null` で曲予想を外す      |
| confidence | number         | 任意 | 1〜5 の整数                        |
| comment    | string \| null | 任意 | 最大500文字。`null` でコメント削除 |

```json
{ "confidence": 5, "song": null }
```

## レスポンス

`200 OK` … 更新後の prediction 行。`updatedAt` が現在時刻に更新される。

## エラー

| HTTP | code               | 条件                          |
| ---- | ------------------ | ----------------------------- |
| 400  | `VALIDATION_ERROR` | スキーマ不一致 / 更新項目ゼロ |
| 401  | `UNAUTHORIZED`     | 未ログイン                    |
| 403  | `FORBIDDEN`        | 他人の予想                    |
| 403  | `SEASON_CLOSED`    | 締切後                        |
| 404  | `NOT_FOUND`        | 予想が存在しない              |

> チェック順: 存在(404) → 本人(403 FORBIDDEN) → 受付中(403 SEASON_CLOSED) → ボディ検証(400)。

## 処理仕様

- アーティスト・シーズンは変更不可（リクエストにも含めない）。
- `song` 指定時は既存アーティスト配下に `resolveExternalSong` で解決。`null` は `song_id` を NULL に。
- 部分更新: 指定された項目のみ反映（`undefined` の項目は据え置き）。
- **編集すると `updated_at` が更新され、早押し係数はその分失われる**（早く出して後で正解に書き換える不正の抑止）。
  公式発表時刻以降の編集は採点対象外（`updated_at >= close_at` は無効）。

## 実装

- [server/src/routes/predictions.ts](../../../server/src/routes/predictions.ts)
- [server/src/schemas/predictions.ts](../../../server/src/schemas/predictions.ts) … `updatePredictionSchema`
- [server/src/repositories/predictions.ts](../../../server/src/repositories/predictions.ts) … `updatePrediction`
