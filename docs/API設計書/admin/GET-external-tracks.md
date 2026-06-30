# GET /api/admin/external/tracks

## 概要

外部音楽DB（Spotify→MusicBrainz フォールバック）で曲を検索する。管理者の手動登録補助用。

## 認可

要管理者（`requireAdmin`）。

## リクエスト

クエリパラメータ:

| 名前 | 型     | 必須 | 説明                         |
| ---- | ------ | ---- | ---------------------------- |
| q    | string | 必須 | 検索語（trim後に空なら 400） |

## レスポンス

`200 OK` … 外部曲候補の配列。形は
[GET /api/songs/external](../songs/GET-external.md) と同じ（`source`/`externalId`/`title`/`artistName`/`releaseYear`）。

## エラー

| HTTP | code               | 条件     |
| ---- | ------------------ | -------- |
| 400  | `VALIDATION_ERROR` | `q` が空 |
| 403  | `FORBIDDEN`        | 非管理者 |

## 処理仕様

- ユーザー向けの `/api/songs/external` と同じ `searchExternalTracks` を使う（認可が管理者）。
- 得た候補を参考に [POST /api/admin/songs](./POST-songs.md) で曲を登録する想定。

## 実装

- [server/src/routes/admin.ts](../../../server/src/routes/admin.ts)
- [server/src/services/externalMusic.ts](../../../server/src/services/externalMusic.ts) … `searchExternalTracks`
