# API設計書

紅白予想アプリのバックエンドAPI。Cloudflare Workers + Hono で実装した REST API。
機械可読な定義は [openapi.yaml](../openapi.yaml) を参照。実装の正は [`server/src/routes/`](../../server/src/routes/)。

> **エンドポイント別の詳細設計書**は [エンドポイント別 API 詳細設計書（索引）](./README.md) を参照。
> 本書は共通仕様・一覧・ドメインロジックの概観をまとめる。

## 1. 共通仕様

- **ベースパス**: `/api`（`/health` のみ例外）。本番は SPA と同一オリジン。
- **形式**: リクエスト/レスポンスとも JSON（`content-type: application/json`）。
- **認証**: セッションCookie `session`（JWT/HS256）。ブラウザからは `credentials: include` で送る。
- **日時**: すべて ISO8601 / UTC 文字列。

### 1.1 エラーレスポンス形式

すべてのエラーは次の形式で返す:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR", // 機械判定用の固定文字列
    "message": "曲名は必須です", // 人間向けの説明（日本語）
  },
}
```

| HTTP | code               | 用途                                                     |
| ---- | ------------------ | -------------------------------------------------------- |
| 400  | `VALIDATION_ERROR` | リクエストの形式・内容が不正                             |
| 401  | `UNAUTHORIZED`     | 未ログイン / 署名検証失敗                                |
| 403  | `FORBIDDEN`        | 権限不足（他人のリソース・管理者専用）                   |
| 403  | `SEASON_CLOSED`    | 締切後の投稿・編集・取消                                 |
| 404  | `NOT_FOUND`        | リソースが存在しない                                     |
| 409  | `CONFLICT`         | 重複（二重予想）/ 前提未充足（締切前のランキング）       |

### 1.2 認可レベル

| 記号       | 意味                                                  |
| ---------- | ----------------------------------------------------- |
| 公開       | 認証不要                                              |
| 要ログイン | `requireAuth`（未ログインは 401）                     |
| 要管理者   | `requireAdmin`（`/api/admin/*` 全体。非管理者は 403） |

## 2. エンドポイント一覧

| メソッド | パス                                | 認可       | 概要                               |
| -------- | ----------------------------------- | ---------- | ---------------------------------- |
| GET      | `/health`                           | 公開       | ヘルスチェック                     |
| GET      | `/api/auth/google/login`            | 公開       | Google認可画面へリダイレクト       |
| GET      | `/api/auth/google/callback`         | 公開       | OAuthコールバック → セッション発行 |
| POST     | `/api/auth/logout`                  | 公開       | ログアウト（Cookie破棄）           |
| GET      | `/api/auth/me`                      | 要ログイン | 現在のユーザー                     |
| PATCH    | `/api/auth/me`                      | 要ログイン | 表示名の変更                       |
| GET      | `/api/seasons`                      | 公開       | シーズン一覧（受付中フラグ付き）   |
| GET      | `/api/seasons/current`              | 公開       | 現在のシーズン                     |
| GET      | `/api/artists`                      | 公開       | アーティスト一覧                   |
| GET      | `/api/artists/search?q=`            | 公開       | アーティスト検索（ローカルDB）     |
| GET      | `/api/artists/external?q=`          | 要ログイン | アーティスト検索（外部音楽DB）     |
| GET      | `/api/artists/:id/songs`            | 公開       | アーティストの曲一覧               |
| GET      | `/api/songs/search?q=`              | 公開       | 曲検索（ローカルDB）               |
| GET      | `/api/songs/external?q=`            | 要ログイン | 曲検索（外部音楽DB）               |
| POST     | `/api/predictions`                  | 要ログイン | 予想の投稿                         |
| GET      | `/api/predictions?seasonId=`        | 公開       | 予想一覧                           |
| PUT      | `/api/predictions/:id`              | 要ログイン | 予想の編集（受付中・本人のみ）     |
| DELETE   | `/api/predictions/:id`              | 要ログイン | 予想の取消（受付中・本人のみ）     |
| GET      | `/api/rankings/overall`             | 公開       | 通算ランキング（締切済み全シーズン合算） |
| GET      | `/api/rankings/:seasonId`           | 公開       | シーズンのランキング（締切後）     |
| POST     | `/api/admin/seasons`                | 要管理者   | シーズン作成                       |
| POST     | `/api/admin/seasons/:id/close`      | 要管理者   | 締切操作（公式発表日時の設定）     |
| POST     | `/api/admin/results`                | 要管理者   | 結果確定（冪等）                   |
| POST     | `/api/admin/artists`                | 要管理者   | アーティスト作成（別名同時可）     |
| POST     | `/api/admin/songs`                  | 要管理者   | 曲作成                             |
| GET      | `/api/admin/external/artists?q=`    | 要管理者   | 外部アーティスト検索（登録補助）   |
| GET      | `/api/admin/external/tracks?q=`     | 要管理者   | 外部曲検索（登録補助）             |

## 3. 主要エンドポイント詳細

### 3.1 認証

#### `GET /api/auth/me` （要ログイン）

```jsonc
// 200
{
  "id": "...",
  "displayName": "ユーザー",
  "email": "u@example.com",
  "avatarUrl": "https://...",
  "isAdmin": false,
}
```

#### `PATCH /api/auth/me` （要ログイン）

```jsonc
// req
{ "displayName": "新しい表示名" } // trim後 1〜50文字
// 200 … me と同形
```

### 3.2 シーズン

#### `GET /api/seasons/current`

```jsonc
// 200
{
  "id": "...",
  "year": 2026,
  "title": null,
  "predictionOpenAt": "2026-11-01T00:00:00.000Z",
  "predictionCloseAt": null,
  "resultConfirmedAt": null,
  "isOpen": true,
} // isOpen = 受付中フラグ
// 404 NOT_FOUND … シーズンが無い
```

### 3.3 検索

- ローカル検索 `GET /api/artists/search` / `/api/songs/search`: 公開。`q` 必須（空なら 400）。
  `limit`（既定20・最大50）。NFKC・小文字・かな正規化した部分一致。
- 外部検索 `GET /api/artists/external` / `/api/songs/external`: **要ログイン**（外部APIクォータ保護）。
  Spotify を主に、未設定/空なら MusicBrainz にフォールバック。返却は外部選択用の最小情報。

```jsonc
// GET /api/artists/external?q=米津 → 200
[
  {
    "source": "spotify",
    "externalId": "...",
    "name": "米津玄師",
    "imageUrl": "https://...",
    "url": "https://...",
    "detail": "j-pop",
  },
]
```

### 3.4 予想

#### `POST /api/predictions` （要ログイン）

外部音楽DBで選んだアーティスト/曲を渡す。サーバーが `(source, external_id)` で
ローカルへ遅延アップサートし、予想にはローカル `id` を保存する。

```jsonc
// req
{
  "seasonId": "...",
  "artist": {
    "source": "spotify",
    "externalId": "abc",
    "name": "米津玄師",
    "imageUrl": null,
    "url": null,
  },
  "song": {
    "source": "spotify",
    "externalId": "xyz",
    "title": "Lemon",
    "releaseYear": 2018,
  }, // null/省略可（出場予想のみ）
  "confidence": 4, // 1〜5の整数
  "comment": "今年は来る", // 任意・最大500文字
}
// 201 … 作成された prediction 行
```

エラー: `404 NOT_FOUND`（シーズン無し） / `403 SEASON_CLOSED`（締切後） /
`409 CONFLICT`（同一アーティストの二重予想） / `400 VALIDATION_ERROR`。

#### `GET /api/predictions?seasonId=` （公開）

予想の一覧。表示用に `artistName` / `songTitle` / `displayName` を付与して返す。

#### `PUT /api/predictions/:id` （要ログイン）

本人・受付中のみ。アーティスト・シーズンは変更不可。`song`（外部選択 or `null`）・
`confidence`・`comment` のうち最低1項目。`song: null` で曲予想を外す。
編集すると `updated_at` が更新され、早押し係数はその分失われる。

エラー: `404` / `403 FORBIDDEN`（他人） / `403 SEASON_CLOSED` / `400`。

#### `DELETE /api/predictions/:id` （要ログイン）

本人・受付中のみ。`{ "ok": true }`。エラーは PUT と同様。

### 3.5 ランキング

#### `GET /api/rankings/:seasonId` （公開）

締切後（`prediction_close_at` 設定済み）のみ。締切前は `409 CONFLICT`、シーズン無しは `404`。

```jsonc
// 200
[{ "rank": 1, "userId": "...", "displayName": "A", "score": 45, "hitCount": 2 }]
```

並び順: ①合計スコア降順 → ②的中件数降順 → ③最初の予想投稿が早い順。
スコア・的中件数が同じなら同順位（競技順位法）。`score` は内部の小数を四捨五入した整数。

#### `GET /api/rankings/overall` （公開）

通算ランキング。結果確定済み（締切済み）の全シーズンのスコアを合算する。レスポンス形は
シーズン版と同じ。締切済みシーズンが無ければ `[]`。`score`（通算ポイント）は**負もあり得る**。

### 3.6 管理（要管理者）

#### `POST /api/admin/seasons`

```jsonc
// req
{ "year": 2027, "title": "第78回", "predictionOpenAt": "2027-11-01T00:00:00Z" }
// 201 … season
```

`year` は 1950〜2100。`title` / `predictionOpenAt` 任意。

#### `POST /api/admin/seasons/:id/close`

```jsonc
// req
{ "announcedAt": "2026-11-20T09:00:00Z" } // 公式発表の日時。過去日時も可
// 200 … 更新後の season（prediction_close_at が設定される）
```

#### `POST /api/admin/results`（結果確定・冪等）

```jsonc
// req
{ "seasonId": "...",
  "entries": [
    { "artistId": "...", "appeared": true,  "songId": "..." },
    { "artistId": "...", "appeared": false }   // appeared=false なら songId は無視され NULL 保存
  ] }                                          // entries は1件以上
// 200
{ "ok": true, "count": 2 }
```

`(season_id, artist_id)` で upsert するため、再送・内容変更しても行は重複せず更新される。

#### `POST /api/admin/artists`

```jsonc
// req
{
  "name": "米津玄師",
  "nameKana": "よねづけんし",
  "genderGroup": "白",
  "officialUrl": "https://...",
  "aliases": ["ハチ", "Kenshi Yonezu"],
} // 任意
// 201 … artist
```

#### `POST /api/admin/songs`

```jsonc
// req
{
  "artistId": "...",
  "title": "Lemon",
  "titleKana": "れもん",
  "releaseYear": 2018,
}
// 201 … song / 404 NOT_FOUND（artistId 不在）
```

## 4. ドメインロジック仕様

### 4.1 受付判定（`domain/season.ts`）

`prediction_close_at` が NULL、または現在 < `prediction_close_at` なら受付中。
投稿・編集・取消は受付中のみ。チェックはサーバー側で行う（フロント表示制御に依存しない）。

### 4.2 スコアリング（`domain/scoring.ts`）

加算方式。アーティストと曲を独立評価して合算する。

| 予想内容         | 結果        | 基礎点       |
| ---------------- | ----------- | ------------ |
| アーティスト＋曲 | 出場○ / 曲○ | +30（10+20） |
| アーティスト＋曲 | 出場○ / 曲✗ | +10          |
| アーティスト＋曲 | 出場✗       | **-10**      |
| 出場予想のみ     | 出場○       | +10          |
| 出場予想のみ     | 出場✗       | **-10**      |

- 外れ -10 はアーティスト的中 +10 と対称（損益分岐＝出場率50%）。撃ち得を防ぐ。
- 合計はマイナスを許容する（floorしない）。

**早押しボーナス**:

- `p = (updated_at - open_at) / (close_at - open_at)` を [0,1] にクランプ、早さ `e = 1 - p`。
- 最終点 = 基礎点 × `(1 + 0.5 × e)`（受付直後の的中は最大1.5倍、締切間際は1.0倍）。
- ボーナスは**正の基礎点のみ**に掛かる。外れ -10 はフラット。
- 早さは `created_at` ではなく **`updated_at`** で測る（後から正解に書き換える不正を防ぐ）。
- 内部は小数で保持し、表示時に四捨五入（`displayScore`）。

**不正投票の除外**: `updated_at >= close_at`（公式発表時刻以降の投稿・編集）は採点対象外（常に0）。
物理削除せず採点時に除外する。確信度（confidence）はMVPでは採点に影響しない。

### 4.3 ランキング（`domain/ranking.ts`）

ユーザー単位に集計し、3.5 の順序で並べる。スコアが付いた（正の点の）予想を `hitCount` に数える。

### 4.4 通算ポイント（`domain/ranking.ts` `combineRankings`）

通算ポイント＝結果確定済み（締切済み）全シーズンのスコア合計。専用テーブルは持たず都度算出する。
各シーズンの `totalScore` / `hitCount` を合算し、`earliestAt` は全シーズンの最初の投稿時刻を採る。
並び順はシーズン版と同じ。**通算スコアはマイナスも許容**（floorしない）。
ポイントは譲渡・換金・購入いずれも不可で、財産的価値を持たせない。
