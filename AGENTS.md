# AGENTS.md

## プロジェクト概要

このプロジェクトは、NHK紅白歌合戦の出場者・歌唱曲・結果を予想するWebアプリケーションです。

ユーザーはアーティストや曲を検索し、予想を投稿し、結果を比較し、ランキングで競い合うことができます。
リアルマネーのギャンブル要素は持たせず、紅白向けの軽量な予想マーケット／ファンタジーリーグのような体験を目指します。

## コアコンセプト

- 紅白の出場者を予想する
- 歌唱曲を予想する
- 予想の的中率を記録する
- 人気度・確信度のトレンドを表示する
- 予想結果でユーザーをランキングする
- 年度ごとのシーズンに対応する

## 技術スタック

**全体をCloudflare上で完結させる**（コストを最小化し、無料枠で運用開始できることを優先）。

### フロントエンド

- React
- TypeScript
- Vite
- React Router または TanStack Router
- TanStack Query
- Zustand
- Tailwind CSS
- ホスティング: Cloudflare Pages

### バックエンド

- Cloudflare Workers
- Hono（Workersネイティブなフレームワーク。Fastifyは使わない）
- TypeScript

### データベース

- Cloudflare D1（SQLite）
- ORM / マイグレーション: Drizzle ORM + drizzle-kit（D1対応）
- セッション等の一時データが必要なら Cloudflare KV を使う
- SQLiteには `pg_trgm` のような類似検索が無い。
  あいまい検索は持たず、部分一致＋かな正規化＋別名テーブルで対応する
  （[検索要件](#検索要件)参照）。

### オプション／将来構想

- Solanaトークン連携
- Spotify／YouTubeのメタデータ表示
- 管理ダッシュボード
- 予想オッズの可視化

## 開発方針

- 最初のバージョンはシンプルに保つ
- 過度な作り込みを避ける
- 完璧なアーキテクチャより、動くMVPを優先する
- Cloudflare（Workers / Pages / D1 / KV）の標準機能で完結させ、外部サービスは増やさない
- 明示的に要求されない限り、NFT関連の機能は避ける
- ギャンブルやリアルマネーの賭け機能は作らない

## MVP機能

### ユーザー機能

- アーティスト一覧の表示
- アーティストの検索
- 曲一覧の表示
- 予想の投稿:
  - アーティスト
  - 曲（任意。出場予想のみも可）
  - 確信度スコア
  - 任意のコメント

- 全員の予想の閲覧
- 結果確定後のランキング閲覧

### 管理者機能

- アーティストの追加／編集
- 曲の追加／編集
- 紅白の年度／シーズンの管理
- 実際の出場者の確定
- 実際の歌唱曲の確定
- スコアの再計算

## 認証

- 認証は **Google OAuth 2.0（OpenID Connect）** を採用する。
  自前のパスワード管理は行わない。
- ログイン成功時、Googleの `sub`（ユーザー固有ID）で `users` を照合し、
  存在しなければ新規作成する（メール・表示名・アバターはGoogleから取得）。
- 同一ユーザーの識別はメールではなく `google_sub` を正とする
  （メールは変更され得るため）。
- セッションはサーバー側で発行する。Workers環境では署名付きの HttpOnly Cookie（JWT等）か、
  Cloudflare KV にセッションを保存する方式を使う。
  予想の投稿・削除など書き込み系APIは認証必須とする。
- 管理者機能は通常ユーザーと区別する（例: `users.is_admin` フラグ、
  または許可メールのallowlist）。MVPでは簡易な方法でよい。

## データモデル案

### 共通方針

D1（SQLite）前提の型方針:

- 主キー `id` は全テーブル UUID 文字列（`TEXT`）。アプリ側で `crypto.randomUUID()` を発番する。
  予想やユーザーのIDがURL/APIに露出するため、連番による推測を防ぐ。
- `created_at` / `updated_at` は全テーブル共通で、UTCのISO8601文字列（`TEXT`）として保持する。
  比較は文字列の辞書順で時系列順になる。各テーブルでの再掲は省略してよい。
- 外部キー（`*_id`）は参照先の `id`（`TEXT`）に合わせる。
- 真偽値（`appeared` など）は SQLite に合わせ `INTEGER`（0/1）で持つ。

### users

- id
- display_name
- email（Googleアカウントのメール / ユニーク）
- google_sub（GoogleのユーザーID = `sub`クレーム / ユニーク）
- avatar_url（任意。Googleのプロフィール画像）
- created_at
- updated_at

### artists

- id
- name
- name_kana
- gender_group
- official_url
- created_at
- updated_at

### artist_aliases

別名（例: 米津玄師 = ハチ / Kenshi Yonezu）を1行ずつ保持する。
別名でもあいまい検索できるよう、配列カラムではなく別テーブルにする。

- id
- artist_id
- alias
- created_at
- updated_at

### songs

- id
- artist_id
- title
- title_kana
- release_year
- created_at
- updated_at

### seasons

- id
- year
- title
- prediction_open_at
- prediction_close_at（nullable。**公式発表の日時**。締切操作で運営が設定。過去日時も可）
- result_confirmed_at
- created_at
- updated_at

### predictions

- id
- user_id
- season_id
- artist_id
- song_id（nullable）
- confidence（1〜5の整数）
- comment
- created_at
- updated_at

制約:

- `(user_id, season_id, artist_id)` にユニーク制約を設ける。
  同一ユーザーが、同一シーズン内で同じアーティストを二重に予想することはできない。
- `song_id` は nullable とし、「出場予想のみ（曲は予想しない）」も許可する。
  曲を予想する場合のみ `song_id` を設定する。
- 重複投稿時はDBの一意性違反に依存せず、サービス層でも事前チェックして
  わかりやすいエラーレスポンス（例: HTTP 409 Conflict）を返す。

### results

公式結果という「事実」を保持するテーブル。点数(`score_value`)は持たない。
点数は予想×結果の突き合わせで算出する（[スコアリングのアイデア](#スコアリングのアイデア)参照）。

- id
- season_id
- artist_id
- appeared（出場したか）
- song_id（出場し、かつ曲が判明した場合のみ。それ以外は NULL）
- created_at
- updated_at

制約:

- `(season_id, artist_id)` にユニーク制約を設ける。
  同一シーズン・同一アーティストの結果は1行のみ。
- `appeared = false` のとき `song_id` は NULL とする。

## スコアリングのアイデア

スコアリングは透明性を保つ。**スコアは加算方式**で、両方当てた予想ほど高得点になる。

採点はアーティストと曲を独立に評価し、合算する:

- アーティスト的中（出場を当てた）: +10
- 曲的中: +20（アーティストも的中している場合のみ加算する）

| 予想内容 | 出場した／曲一致 | 合計 |
|---|---|---|
| アーティスト＋曲 | 出場 ○ / 曲 ○ | +30（10 + 20） |
| アーティスト＋曲 | 出場 ○ / 曲 ✗ | +10 |
| アーティスト＋曲 | 出場 ✗ | 0 |
| 出場予想のみ（曲なし） | 出場 ○ | +10 |
| 出場予想のみ（曲なし） | 出場 ✗ | 0 |

### 早押しボーナス

早く予想した人ほど有利にするため、上の基礎点に「早さ係数」を掛ける。

- 早さを受付期間内の位置で測る:
  - `p = (予想の updated_at - prediction_open_at) / (prediction_close_at - prediction_open_at)`
    （0 = 最速、1 = 締切間際。範囲外は 0〜1 にクランプ）
  - 早さ `e = 1 - p`
- **最終点 = 基礎点 × (1 + 0.5 × e)**
  - 受付開始直後の的中 → 基礎点の最大 1.5 倍
  - 締切間際の的中 → 基礎点の 1.0 倍（ボーナスなし）
- ボーナスは**獲得した基礎点にのみ掛かる**（外れは0点なので影響なし）。
- 早さは `created_at` ではなく **`updated_at`（最後に内容を変えた時刻）** で測る。
  編集するとその分だけ早さは失われる（早く出して後で正解に書き換える不正を防ぐ）。
- 点数は内部では小数で保持し、**表示時に整数へ四捨五入**する。

補足:

- 確信度（`confidence`, 1〜5）はMVPでは**スコアに影響させない**。
  本人の自信表明・表示用にとどめる（高確信度ボーナスは将来の拡張）。
- 予想外れのペナルティ: 任意。ただしMVPでは避ける
- 採点ロジックには必ずテストを書く（上表の全ケース＋早押し係数の境界を網羅する）。

## 予想の受付ルール

紅白の公式発表がいつ行われるかは事前に確定できないため、締切は**後から運営が設定する**。

- `prediction_close_at` は最初は NULL（＝受付中）。
- 締切操作は管理API（例: `POST /admin/seasons/:id/close`）で行い、
  運営が **公式発表の日時** を `prediction_close_at` に設定する。
  この値は操作時点より過去でもよい（現実の発表時刻が正）。
- **投稿可否（投稿API側）**:
  - `prediction_close_at IS NULL` または `now < prediction_close_at` → 受付中、投稿OK
  - それ以外 → 403 `SEASON_CLOSED` で拒否
- **編集・取消（`PUT` / `DELETE /predictions/:id`）**:
  - 受付中のみ可。締切後は 403 `SEASON_CLOSED` で拒否。
  - 操作できるのは**自分の予想のみ**。他人の予想は 403 `FORBIDDEN`。
- **採点対象**: `predictions.updated_at < prediction_close_at` の予想のみ有効。
  判定は投稿時刻ではなく**最後に内容を変えた時刻**で見る
  （早く投稿して発表後に正解へ書き換える不正を防ぐため）。
  公式発表の時刻以降に投稿・編集された予想は、たとえ締切操作より前であっても
  **不正投票として採点・ランキングから除外する**。
- 不正投票は物理削除せず、採点時に除外する（監査のため記録は残す）。
- チェックは必ずサーバー側で行う（フロントの表示制御だけに依存しない）。
- `GET /seasons/current` は受付中かどうかのフラグも返す。

## ランキング

`GET /rankings/:seasonId` の並び順は次の優先度で決める:

1. 合計スコアの高い順
2. 同点なら的中した予想件数の多い順
3. それも同じなら、最初の予想投稿が早い順（`predictions.created_at`）

## 検索要件

D1（SQLite）には `pg_trgm` のような類似検索が無いため、**高度なあいまい検索は持たない**。
ユーザーが正しく入力する前提とし（予想という性質上、ある程度の手間はユーザーに委ねる）、
シンプルな部分一致を基本とする。

対応する範囲:

- **部分一致**: `LIKE '%q%'`（前方・中間一致）で検索する。
- **かな違い**: 入力・対象ともにかなへ正規化して比較できるよう、`name_kana` / `title_kana` を持つ。
  検索クエリもかなに正規化してから `name_kana` / `title_kana` に当てる。
- **別名・英語表記**: `artist_aliases` テーブルの `alias` も検索対象に含める。

対応しない（割り切る）範囲:

- タイプミスの自動補正・類似度スコアによるあいまい一致は行わない。
- 必要になれば将来 SQLite の FTS5 導入を検討する（MVPでは入れない）。

検索対象カラム: artists(`name`, `name_kana`) / artist_aliases(`alias`) / songs(`title`, `title_kana`)。

## API設計

MVPではRESTを使う。

エンドポイント例:

- `GET /artists`
- `GET /artists/search?q=`
- `GET /songs/search?q=`
- `GET /seasons/current`
- `POST /predictions`
- `GET /predictions`
- `PUT /predictions/:id`
- `DELETE /predictions/:id`
- `GET /rankings/:seasonId`
- `POST /admin/seasons/:id/close`
- `POST /admin/results`

## エラーハンドリングとバリデーション

### エラーレスポンス形式

すべてのAPIは、エラー時に次の形式で返す:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR", // 機械判定用の固定文字列
    "message": "曲名は必須です"   // 人間向けの説明
  }
}
```

HTTPステータスの使い分け:

- 400 `VALIDATION_ERROR` — リクエストの形式・内容が不正
- 401 `UNAUTHORIZED` — 未ログイン
- 403 `FORBIDDEN` — 権限不足（管理者専用APIなど）
- 404 `NOT_FOUND` — リソースが存在しない
- 409 `CONFLICT` — 重複（同一アーティストの二重予想など）

### バリデーション

- リクエストボディ／クエリの検証には **Zod** を使う。
- スキーマを1度定義し、検証と TypeScript 型の両方をそこから得る
  （`z.infer` で型を導出し、型とバリデーションを二重管理しない）。
- 検証に失敗したら、上記の `VALIDATION_ERROR`（400）形式で返す。
- スキーマは `src/schemas/` に置く。

## コーディングルール

- TypeScriptを厳格モードで使う
- 明示的な型付けを優先する
- `any` を避ける
- 関数は小さく保つ
- ドメインロジックとルートハンドラを分離する
- リクエストボディをバリデーションする
- 一貫したエラーレスポンスを返す

## バックエンド構成

Cloudflare Workers（Hono）のエントリは `src/index.ts`。
D1/KV などのバインディングは `wrangler.jsonc` で定義し、`Env` 型として受け取る。

```txt
src/
  index.ts        // Workersエントリ（Honoアプリ）
  routes/
  services/
  repositories/   // D1アクセス（Drizzle）
  schemas/        // Zodスキーマ
  db/             // Drizzleスキーマ・マイグレーション
  types/          // Env（バインディング）など
wrangler.jsonc
```

## フロントエンド構成

```txt
src/
  main.tsx
  app/
  pages/
  components/
  features/
  hooks/
  lib/
  stores/
  types/
```

### 状態管理の役割分担

- **サーバー由来のデータ（API取得・送信）は必ず TanStack Query** で扱う。
  キャッシュ・再取得・ローディング/エラーはQueryに任せ、サーバーデータを
  Zustandに手動でコピーしない。
- **Zustand はサーバーと無関係なUIローカル状態だけ**に使う
  （モーダルの開閉、選択中タブなど）。単純なものは `useState` で十分。

## AIエージェントへの指示

このプロジェクトを変更する際は:

1. まずこのファイルを読む。
2. シンプルで保守しやすい実装を優先する。
3. 理由なく新しいフレームワークを導入しない。
4. 明示的に要求されない限り、ブロックチェーン・NFT・トークン機能を追加しない。
5. MVPのスコープを小さく保つ。
6. Cloudflare（Workers / D1 / KV / Pages）の標準機能で解決する。
7. スコアリングと予想ロジックにはテストを追加する。
8. 大きなアーキテクチャ変更を行う前に、その内容を説明する。

## MVPのゴール

最初のリリースでは、ユーザーが以下を行えるようにする:

1. アーティストを検索する
2. 予想する曲を選択する
3. 予想を投稿する
4. 予想一覧を見る
5. 管理者が結果を確定した後、ランキングを見る

これ以外はすべて将来のスコープとする。
