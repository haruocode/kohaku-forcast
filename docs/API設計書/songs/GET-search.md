# GET /api/songs/search

## 概要

ローカルDBの曲を部分一致で検索する。`title` / `title_kana` が対象。アーティスト名を添えて返す。

## 認可

公開（認証不要）。

## リクエスト

クエリパラメータ:

| 名前  | 型     | 必須 | 既定 | 説明                         |
| ----- | ------ | ---- | ---- | ---------------------------- |
| q     | string | 必須 | －   | 検索語（trim後に空なら 400） |
| limit | number | 任意 | 20   | 最大 50                      |

## レスポンス

`200 OK` … アーティスト名付き Song の配列。

```json
[
  {
    "id": "uuid",
    "artistId": "uuid",
    "title": "Lemon",
    "titleKana": "れもん",
    "releaseYear": 2018,
    "artistName": "米津玄師",
    "source": null,
    "externalId": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

## エラー

| HTTP | code               | 条件     |
| ---- | ------------------ | -------- |
| 400  | `VALIDATION_ERROR` | `q` が空 |

## 例

```bash
curl -s 'http://localhost:8787/api/songs/search?q=レモン'
```

## 処理仕様

- 検索の正規化は [GET /api/artists/search](../artists/GET-search.md) と同じ（NFKC・小文字・かな・空白除去）。
- 別名の概念は曲には無い（`title` / `title_kana` のみ）。

## 実装

- [server/src/routes/songs.ts](../../../server/src/routes/songs.ts)
- [server/src/services/search.ts](../../../server/src/services/search.ts) … `searchSongs`
