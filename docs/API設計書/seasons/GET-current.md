# GET /api/seasons/current

## 概要

現在のシーズン（＝最新年のシーズン）を受付中フラグ付きで返す。予想・ランキング画面の起点。

## 認可

公開（認証不要）。

## リクエスト

なし。

## レスポンス

`200 OK` … Season（`isOpen` 付き）。形は [GET /api/seasons](./GET-seasons.md) の1件と同じ。

```json
{
  "id": "uuid",
  "year": 2026,
  "title": null,
  "predictionOpenAt": "2026-11-01T00:00:00.000Z",
  "predictionCloseAt": null,
  "resultConfirmedAt": null,
  "isOpen": true
}
```

## エラー

| HTTP | code        | 条件                |
| ---- | ----------- | ------------------- |
| 404  | `NOT_FOUND` | シーズンが1件も無い |

## 例

```bash
curl -s http://localhost:8787/api/seasons/current
```

## 処理仕様

- 「現在のシーズン」は `year` 降順の先頭1件で定義する（明示的な「アクティブ」フラグは持たない）。
- `isOpen` の判定はサーバー側で行い、フロントは表示制御にのみ使う（投稿可否は投稿APIが再判定）。

## 実装

- [server/src/routes/seasons.ts](../../../server/src/routes/seasons.ts)
- [server/src/repositories/seasons.ts](../../../server/src/repositories/seasons.ts) … `getCurrentSeason`
