# GET /api/artists/:id/songs

## 概要

指定アーティストのローカル登録済みの曲一覧を返す（曲名順）。

## 認可

公開（認証不要）。

## リクエスト

パスパラメータ:

| 名前 | 型     | 説明                                    |
| ---- | ------ | --------------------------------------- |
| id   | string | アーティストID（ローカル `artists.id`） |

## レスポンス

`200 OK` … Song の配列。

```json
[
  {
    "id": "uuid",
    "artistId": "uuid",
    "title": "Lemon",
    "titleKana": "れもん",
    "releaseYear": 2018,
    "source": null,
    "externalId": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

## エラー

| HTTP | code        | 条件                     |
| ---- | ----------- | ------------------------ |
| 404  | `NOT_FOUND` | アーティストが存在しない |

## 例

```bash
curl -s http://localhost:8787/api/artists/<artistId>/songs
```

## 処理仕様

- アーティストの存在を確認してから曲を引く。
- 予想時の曲選択は通常 [GET /api/songs/external](../songs/GET-external.md) を使う。本APIはローカル登録曲の参照用。

## 実装

- [server/src/routes/artists.ts](../../../server/src/routes/artists.ts)
- [server/src/repositories/songs.ts](../../../server/src/repositories/songs.ts) … `listSongsByArtist`
