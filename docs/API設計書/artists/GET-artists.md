# GET /api/artists

## 概要

ローカルDBのアーティスト一覧を名前順で返す。一覧・管理表示用。

## 認可

公開（認証不要）。

## リクエスト

なし。

## レスポンス

`200 OK` … Artist の配列（`name` 昇順）。

```json
[
  {
    "id": "uuid",
    "name": "米津玄師",
    "nameKana": "よねづけんし",
    "genderGroup": "白",
    "officialUrl": "https://...",
    "source": null,
    "externalId": null,
    "imageUrl": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

## エラー

なし。

## 処理仕様

- 手動登録・外部由来（遅延アップサート済み）の両方を含む。
- 予想時のアーティスト選択は外部検索（[GET /api/artists/external](./GET-external.md)）を使う。
  本エンドポイントは一覧・管理用。

## 実装

- [server/src/routes/artists.ts](../../../server/src/routes/artists.ts)
- [server/src/repositories/artists.ts](../../../server/src/repositories/artists.ts) … `listArtists`
