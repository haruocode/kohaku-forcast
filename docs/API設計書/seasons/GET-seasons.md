# GET /api/seasons

## 概要

シーズン（年度）の一覧を新しい年から返す。各行に受付中フラグ `isOpen` を付与する。

## 認可

公開（認証不要）。

## リクエスト

なし。

## レスポンス

`200 OK` … Season の配列。

```json
[
  {
    "id": "uuid",
    "year": 2026,
    "title": null,
    "predictionOpenAt": "2026-11-01T00:00:00.000Z",
    "predictionCloseAt": null,
    "resultConfirmedAt": null,
    "createdAt": "2026-...",
    "updatedAt": "2026-...",
    "isOpen": true
  }
]
```

| フィールド        | 型             | 説明                                            |
| ----------------- | -------------- | ----------------------------------------------- |
| year              | number         | 年度（UNIQUE）                                  |
| predictionCloseAt | string \| null | 締切＝公式発表日時。NULL=受付中                 |
| isOpen            | boolean        | 受付中フラグ（`isAcceptingPredictions` の結果） |

## エラー

なし。

## 処理仕様

- `year` の降順で返す。
- `isOpen` は `predictionCloseAt` が NULL もしくは現在 < 締切 のとき true。

## 実装

- [server/src/routes/seasons.ts](../../../server/src/routes/seasons.ts)
- [server/src/domain/season.ts](../../../server/src/domain/season.ts) … `isAcceptingPredictions`
- [server/src/repositories/seasons.ts](../../../server/src/repositories/seasons.ts) … `listSeasons`
