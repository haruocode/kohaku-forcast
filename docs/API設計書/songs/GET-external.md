# GET /api/songs/external

## 概要

外部音楽DB（Spotify→MusicBrainz フォールバック）で曲を検索する。予想時の曲選択用。

## 認可

要ログイン（`requireAuth`）。外部APIのクォータ保護のため。

## リクエスト

クエリパラメータ:

| 名前 | 型     | 必須 | 説明                         |
| ---- | ------ | ---- | ---------------------------- |
| q    | string | 必須 | 検索語（trim後に空なら 400） |

## レスポンス

`200 OK` … 外部曲候補の配列。

```json
[
  {
    "source": "spotify",
    "externalId": "trk123",
    "title": "Lemon",
    "artistName": "米津玄師",
    "releaseYear": 2018
  }
]
```

| フィールド  | 型                         | 説明                         |
| ----------- | -------------------------- | ---------------------------- |
| source      | "spotify" \| "musicbrainz" | 出所                         |
| externalId  | string                     | 出所内のID                   |
| title       | string                     | 曲名                         |
| artistName  | string                     | アーティスト名（候補識別用） |
| releaseYear | number \| null             | リリース年                   |

## エラー

| HTTP | code               | 条件       |
| ---- | ------------------ | ---------- |
| 400  | `VALIDATION_ERROR` | `q` が空   |
| 401  | `UNAUTHORIZED`     | 未ログイン |

## 例

```bash
curl -s 'http://localhost:8787/api/songs/external?q=lemon' -b cookie.txt
```

## 処理仕様

- 得た候補を [POST /api/predictions](../predictions/POST-predictions.md) の `song` に渡すと、
  サーバーが解決済みローカルアーティスト配下に遅延アップサートする。
- 曲は任意。選ばなければ「出場予想のみ」になる。

## 実装

- [server/src/routes/songs.ts](../../../server/src/routes/songs.ts)
- [server/src/services/externalMusic.ts](../../../server/src/services/externalMusic.ts) … `searchExternalTracks`
