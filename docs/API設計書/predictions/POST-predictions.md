# POST /api/predictions

## 概要

予想を投稿する。外部音楽DBで選んだアーティスト/曲を渡すと、サーバーが `(source, externalId)` で
ローカルへ遅延アップサート（find-or-create）し、ローカル `id` で予想を作成する。

## 認可

要ログイン（`requireAuth`）。

## リクエスト

ボディ（JSON）。Zod `createPredictionSchema` で検証。

| フィールド | 型             | 必須 | 制約                                    |
| ---------- | -------------- | ---- | --------------------------------------- |
| seasonId   | string         | 必須 | 1文字以上                               |
| artist     | object         | 必須 | 外部アーティスト（下記）                |
| song       | object \| null | 任意 | 外部曲（下記）。省略/nullで出場予想のみ |
| confidence | number         | 必須 | 1〜5 の整数                             |
| comment    | string         | 任意 | 最大500文字                             |

`artist` オブジェクト:

| フィールド | 型                         | 必須 |
| ---------- | -------------------------- | ---- |
| source     | "spotify" \| "musicbrainz" | 必須 |
| externalId | string                     | 必須 |
| name       | string                     | 必須 |
| imageUrl   | string \| null             | 任意 |
| url        | string \| null             | 任意 |

`song` オブジェクト:

| フィールド  | 型                         | 必須 |
| ----------- | -------------------------- | ---- |
| source      | "spotify" \| "musicbrainz" | 必須 |
| externalId  | string                     | 必須 |
| title       | string                     | 必須 |
| releaseYear | number \| null             | 任意 |

```json
{
  "seasonId": "uuid",
  "artist": { "source": "spotify", "externalId": "abc", "name": "米津玄師" },
  "song": {
    "source": "spotify",
    "externalId": "xyz",
    "title": "Lemon",
    "releaseYear": 2018
  },
  "confidence": 4,
  "comment": "今年は来る"
}
```

## レスポンス

`201 Created` … 作成された prediction 行（ローカルID）。

```json
{
  "id": "uuid",
  "userId": "uuid",
  "seasonId": "uuid",
  "artistId": "uuid",
  "songId": "uuid",
  "confidence": 4,
  "comment": "今年は来る",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## エラー

| HTTP | code               | 条件                                                   |
| ---- | ------------------ | ------------------------------------------------------ |
| 400  | `VALIDATION_ERROR` | スキーマ不一致（confidence範囲外など）                 |
| 401  | `UNAUTHORIZED`     | 未ログイン                                             |
| 403  | `SEASON_CLOSED`    | 締切後（`now >= prediction_close_at`）                 |
| 404  | `NOT_FOUND`        | シーズンが存在しない                                   |
| 409  | `CONFLICT`         | 同一ユーザー・同一シーズンで同じアーティストを二重予想 |

## 処理仕様

1. シーズン存在確認（無ければ 404）。
2. 受付判定 `isAcceptingPredictions`（締切後は 403 `SEASON_CLOSED`）。
3. `resolveExternalArtist` でアーティストをローカルへ解決。
4. `findDuplicate` で重複チェック（DB一意制約 `(user_id, season_id, artist_id)` に加えサービス層でも事前確認 → 409）。
5. `song` があれば解決済みアーティスト配下に `resolveExternalSong`。
6. `createPrediction` で作成。`created_at`/`updated_at` は同時刻。

- 採点・有効性は `updated_at` で測るため、後で編集すると早押し係数が下がる。

## 実装

- [server/src/routes/predictions.ts](../../../server/src/routes/predictions.ts)
- [server/src/schemas/predictions.ts](../../../server/src/schemas/predictions.ts)
- [server/src/repositories/artists.ts](../../../server/src/repositories/artists.ts) … `resolveExternalArtist`
- [server/src/repositories/songs.ts](../../../server/src/repositories/songs.ts) … `resolveExternalSong`
- [server/src/repositories/predictions.ts](../../../server/src/repositories/predictions.ts) … `findDuplicate`, `createPrediction`
- [server/src/domain/season.ts](../../../server/src/domain/season.ts) … `isAcceptingPredictions`
