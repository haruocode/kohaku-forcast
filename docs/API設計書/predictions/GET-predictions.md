# GET /api/predictions

## 概要

予想の一覧を返す（公開）。表示用にアーティスト名・曲名・予想者名を JOIN して付与する。

## 認可

公開（認証不要）。

## リクエスト

クエリパラメータ:

| 名前     | 型     | 必須 | 説明                             |
| -------- | ------ | ---- | -------------------------------- |
| seasonId | string | 任意 | 指定すると当該シーズンに絞り込む |

## レスポンス

`200 OK` … 予想（詳細）の配列。`createdAt` 降順。

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "seasonId": "uuid",
    "artistId": "uuid",
    "songId": "uuid",
    "confidence": 4,
    "comment": "今年は来る",
    "createdAt": "...",
    "updatedAt": "...",
    "artistName": "米津玄師",
    "songTitle": "Lemon",
    "displayName": "ユーザーA"
  }
]
```

| 追加フィールド | 型             | 説明                          |
| -------------- | -------------- | ----------------------------- |
| artistName     | string         | アーティスト名                |
| songTitle      | string \| null | 曲名（出場予想のみなら null） |
| displayName    | string         | 予想者の表示名                |

## エラー

なし。

## 例

```bash
curl -s 'http://localhost:8787/api/predictions?seasonId=<seasonId>'
```

## 処理仕様

- `artists` を INNER JOIN、`songs` を LEFT JOIN（曲なし予想を許容）、`users` を INNER JOIN。
- 公開のため誰の予想も見える。フロントは `userId` と自分を比較して操作ボタン（編集・取消）の出し分けを行う
  （権限の最終判定は PUT/DELETE 側）。

## 実装

- [server/src/routes/predictions.ts](../../../server/src/routes/predictions.ts)
- [server/src/repositories/predictions.ts](../../../server/src/repositories/predictions.ts) … `listPredictionsDetailed`
