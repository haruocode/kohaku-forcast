# エンドポイント別 API 詳細設計書

[API設計書.md](./API設計書.md) の共通仕様（エラー形式・認可・日時規約）を前提に、
1エンドポイント＝1ファイルで詳細を記述する。リソースごとにサブフォルダで分類する。

## 索引

### system

- [GET /health](./system/GET-health.md)

### auth（認証・ユーザー）

- [GET /api/auth/google/login](./auth/GET-google-login.md)
- [GET /api/auth/google/callback](./auth/GET-google-callback.md)
- [POST /api/auth/logout](./auth/POST-logout.md)
- [GET /api/auth/me](./auth/GET-me.md)
- [PATCH /api/auth/me](./auth/PATCH-me.md)

### seasons（シーズン）

- [GET /api/seasons](./seasons/GET-seasons.md)
- [GET /api/seasons/current](./seasons/GET-current.md)

### artists（アーティスト）

- [GET /api/artists](./artists/GET-artists.md)
- [GET /api/artists/search](./artists/GET-search.md)
- [GET /api/artists/external](./artists/GET-external.md)
- [GET /api/artists/:id/songs](./artists/GET-id-songs.md)

### songs（曲）

- [GET /api/songs/search](./songs/GET-search.md)
- [GET /api/songs/external](./songs/GET-external.md)

### predictions（予想）

- [POST /api/predictions](./predictions/POST-predictions.md)
- [GET /api/predictions](./predictions/GET-predictions.md)
- [PUT /api/predictions/:id](./predictions/PUT-id.md)
- [DELETE /api/predictions/:id](./predictions/DELETE-id.md)

### rankings（ランキング）

- [GET /api/rankings/:seasonId](./rankings/GET-seasonId.md)

### wallet（ウォレット・記念トークン）

- [POST /api/wallet/challenge](./wallet/POST-challenge.md)
- [POST /api/wallet/link](./wallet/POST-link.md)
- [GET /api/wallet/awards](./wallet/GET-awards.md)

### admin（管理／要管理者）

- [POST /api/admin/seasons](./admin/POST-seasons.md)
- [POST /api/admin/seasons/:id/close](./admin/POST-seasons-id-close.md)
- [POST /api/admin/seasons/:id/distribute](./admin/POST-seasons-id-distribute.md)
- [POST /api/admin/results](./admin/POST-results.md)
- [POST /api/admin/artists](./admin/POST-artists.md)
- [POST /api/admin/songs](./admin/POST-songs.md)
- [GET /api/admin/external/artists](./admin/GET-external-artists.md)
- [GET /api/admin/external/tracks](./admin/GET-external-tracks.md)

## 各ファイルの書式

| 節         | 内容                                   |
| ---------- | -------------------------------------- |
| 概要       | 何をするエンドポイントか               |
| 認可       | 公開 / 要ログイン / 要管理者           |
| リクエスト | パス・クエリ・ボディ（型・必須・制約） |
| レスポンス | 正常時の本文・フィールド               |
| エラー     | 発生し得る HTTP / code                 |
| 例         | curl とリクエスト/レスポンス例         |
| 処理仕様   | ドメインロジック・副作用・冪等性など   |
| 実装       | 関連ソースファイル                     |

