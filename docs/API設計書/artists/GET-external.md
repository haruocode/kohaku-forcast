# GET /api/artists/external

## 概要

外部音楽DB（Spotify を主、未設定/空なら MusicBrainz へフォールバック）でアーティストを検索する。
予想時にアーティストを直接選ぶための候補取得。事前登録は不要で、選択時に遅延アップサートされる。

## 認可

要ログイン（`requireAuth`）。外部APIのクォータ保護のため。

> ルート登録順の都合で `/external` は `/:id/songs` より先に定義される（パス衝突回避）。

## リクエスト

クエリパラメータ:

| 名前 | 型     | 必須 | 説明                         |
| ---- | ------ | ---- | ---------------------------- |
| q    | string | 必須 | 検索語（trim後に空なら 400） |

## レスポンス

`200 OK` … 外部アーティスト候補の配列（最大10件程度）。

```json
[
  {
    "source": "spotify",
    "externalId": "abc123",
    "name": "米津玄師",
    "imageUrl": "https://i.scdn.co/...",
    "url": "https://open.spotify.com/...",
    "detail": "j-pop, j-rock"
  }
]
```

| フィールド | 型                         | 説明                                 |
| ---------- | -------------------------- | ------------------------------------ |
| source     | "spotify" \| "musicbrainz" | 出所                                 |
| externalId | string                     | 出所内のID                           |
| name       | string                     | 名称                                 |
| imageUrl   | string \| null             | 画像（MusicBrainz は null）          |
| url        | string \| null             | 外部ページURL                        |
| detail     | string \| null             | ジャンルや国など候補識別用の短い説明 |

## エラー

| HTTP | code               | 条件       |
| ---- | ------------------ | ---------- |
| 400  | `VALIDATION_ERROR` | `q` が空   |
| 401  | `UNAUTHORIZED`     | 未ログイン |

## 例

```bash
curl -s 'http://localhost:8787/api/artists/external?q=米津' -b cookie.txt
```

## 処理仕様

1. `SPOTIFY_CLIENT_ID/SECRET` が設定済みなら Spotify を検索（client_credentials, market=JP）。
2. Spotify が未設定・0件・失敗なら MusicBrainz へフォールバック（User-Agent 必須）。
3. ここで得た候補オブジェクトを、そのまま [POST /api/predictions](../predictions/POST-predictions.md) の
   `artist` として送ると、サーバーが `(source, externalId)` でローカルへ取り込む。

## 実装

- [server/src/routes/artists.ts](../../../server/src/routes/artists.ts)
- [server/src/services/externalMusic.ts](../../../server/src/services/externalMusic.ts) … `searchExternalArtists`
