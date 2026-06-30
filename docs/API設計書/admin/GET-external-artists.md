# GET /api/admin/external/artists

## 概要

外部音楽DB（Spotify→MusicBrainz フォールバック）でアーティストを検索する。管理者の手動登録補助用。

## 認可

要管理者（`requireAdmin`）。

## リクエスト

クエリパラメータ:

| 名前 | 型     | 必須 | 説明                         |
| ---- | ------ | ---- | ---------------------------- |
| q    | string | 必須 | 検索語（trim後に空なら 400） |

## レスポンス

`200 OK` … 外部アーティスト候補の配列。形は
[GET /api/artists/external](../artists/GET-external.md) と同じ（`source`/`externalId`/`name`/`imageUrl`/`url`/`detail`）。

## エラー

| HTTP | code               | 条件     |
| ---- | ------------------ | -------- |
| 400  | `VALIDATION_ERROR` | `q` が空 |
| 403  | `FORBIDDEN`        | 非管理者 |

## 処理仕様

- ユーザー向けの `/api/artists/external` と同じ `searchExternalArtists` を使う。
  用途が「管理者の登録補助」である点だけが異なる（認可が管理者）。
- ここで得た候補を [POST /api/admin/artists](./POST-artists.md) の入力作成に使う想定。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/services/externalMusic.ts](../../../server/src/services/externalMusic.ts) … `searchExternalArtists`
