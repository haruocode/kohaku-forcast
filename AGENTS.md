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

### 採用（MVP後の拡張）

- 記念トークン（Solana / 譲渡不可）。詳細は[記念トークン](#記念トークンソウルバウンド)。

### オプション／将来構想

- Spotify／YouTubeのメタデータ表示
- 管理ダッシュボード
- 予想オッズの可視化

## 開発方針

- 最初のバージョンはシンプルに保つ
- 過度な作り込みを避ける
- 完璧なアーキテクチャより、動くMVPを優先する
- Cloudflare（Workers / Pages / D1 / KV）の標準機能で完結させ、外部サービスは増やさない
- ブロックチェーン/トークン機能は原則避ける。例外として、
  **譲渡不可（ソウルバウンド）の記念トークン**のみ採用する（[記念トークン](#記念トークンソウルバウンド)）。
- ギャンブルやリアルマネーの賭け機能は作らない。
  記念トークンは譲渡不可で売買できず価値が付かないため、この方針と矛盾しない。

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
- is_admin（管理者フラグ）
- solana_address（任意。記念トークンの送付先。所有確認後に設定）
- wallet_verified_at（任意。ウォレット所有を署名で確認した時刻）
- created_at
- updated_at

### artists

- id
- name
- name_kana
- gender_group
- official_url
- source（nullable。外部音楽DB由来なら `spotify` / `musicbrainz`。手動登録は NULL）
- external_id（nullable。`source` 内での外部ID）
- image_url（nullable。主に Spotify の画像）
- created_at
- updated_at

`(source, external_id)` にユニーク制約を設け、同じ外部アーティストを1行に集約する
（SQLite では NULL 同士は別物扱いなので、手動登録の行は重複しない）。
ユーザーが外部から直接予想したとき、**(source, external_id) をキーに find-or-create
（遅延アップサート）**してローカル行を用意し、予想にはそのローカル `id` を保存する。
これにより採点・結果突合・ランキングは常にローカル `artist_id` だけで回る。

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
- source（nullable。artists と同じ方針）
- external_id（nullable。`(source, external_id)` にユニーク制約）
- created_at
- updated_at

artists と同様、外部から選んだ曲も遅延アップサートでローカル行に解決し、
予想には `song_id`（ローカル）を保存する。

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

### token_awards

記念トークンの配布記録。二重配布を防ぐための冪等性の台帳。

- id
- user_id
- season_id
- amount（配布した枚数）
- solana_address（配布時点の送付先）
- tx_signature（Solanaのトランザクション署名。送信成功で設定）
- status（pending / sent / failed）
- created_at
- updated_at

制約:

- `(user_id, season_id)` にユニーク制約を設ける。
  同一ユーザー・同一シーズンへの配布は1回のみ（再実行しても重複配布しない）。

## スコアリングのアイデア

スコアリングは透明性を保つ。**スコアは加算方式**で、両方当てた予想ほど高得点になる。

採点はアーティストと曲を独立に評価し、合算する:

- アーティスト的中（出場を当てた）: +10
- 曲的中: +20（アーティストも的中している場合のみ加算する）
- アーティスト外れ（予想したアーティストが未出場）: **-10**（減点）

| 予想内容               | 出場した／曲一致 | 合計           |
| ---------------------- | ---------------- | -------------- |
| アーティスト＋曲       | 出場 ○ / 曲 ○    | +30（10 + 20） |
| アーティスト＋曲       | 出場 ○ / 曲 ✗    | +10            |
| アーティスト＋曲       | 出場 ✗           | **-10**        |
| 出場予想のみ（曲なし） | 出場 ○           | +10            |
| 出場予想のみ（曲なし） | 出場 ✗           | **-10**        |

外れの減点はアーティスト的中 +10 と**対称**（損益分岐＝出場確率50%）にしている。
「来ると五分以上に思えるアーティストだけ予想する」のが最適になり、
むやみに数を撒くと外れ分でマイナスになって**撃ち得を防ぐ**のがねらい。
このバランスを効かせるため、管理者は**出場しそうにない候補もある程度登録**しておく
（候補が出場者ばかりだと母数の出場率が高すぎてどんな減点でも撒き得が残る）。
曲だけ外した場合（出場は的中）は減点しない＝アーティストの読みは当たっているため +10 を維持する。
合計スコアはマイナスを許容する（floorしない）。減点はフラットで早押し倍率は掛けない。

### 早押しボーナス

早く予想した人ほど有利にするため、上の基礎点に「早さ係数」を掛ける。

- 早さを受付期間内の位置で測る:
  - `p = (予想の updated_at - prediction_open_at) / (prediction_close_at - prediction_open_at)`
    （0 = 最速、1 = 締切間際。範囲外は 0〜1 にクランプ）
  - 早さ `e = 1 - p`
- **最終点 = 基礎点 × (1 + 0.5 × e)**
  - 受付開始直後の的中 → 基礎点の最大 1.5 倍
  - 締切間際の的中 → 基礎点の 1.0 倍（ボーナスなし）
- ボーナスは**獲得した基礎点にのみ掛かる**（外れの減点 -10 はフラットで早押しの影響を受けない）。
- 早さは `created_at` ではなく **`updated_at`（最後に内容を変えた時刻）** で測る。
  編集するとその分だけ早さは失われる（早く出して後で正解に書き換える不正を防ぐ）。
- 点数は内部では小数で保持し、**表示時に整数へ四捨五入**する。

補足:

- 確信度（`confidence`, 1〜5）はMVPでは**スコアに影響させない**。
  本人の自信表明・表示用にとどめる（高確信度ボーナスは将来の拡張）。
- 予想外れのペナルティ: **採用**。アーティスト外れ -10（上記参照）。
  撃ち得を防ぎ「むやみに撒くと損する」ようにするため。
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

## 記念トークン（ソウルバウンド）

予想の的中に応じて配る記念トークン。話題作り・差別化のためのスパイスであり、
**換金性は持たせない**。ユーザーは自分のSolanaウォレットで保有して見せびらかせる。

### 方針

- **譲渡不可（ソウルバウンド）**。Solana の **Token-2022 + NonTransferable 拡張**で発行する。
  売買・移転できないため二次流通で価格が付かず、「ギャンブルにしない」方針と両立する。
- ネットワークは **まず Devnet** で実装・検証し、安定後に Mainnet へ移行する。
- 価値を持たせない・賭けに使わせない（賞金/ベット用途は禁止）。

### 配布ルール

- 配布タイミングは**結果確定（採点）後**。シーズンごとに1回。
- 配布量は的中スコアに連動させる（例: そのシーズンの合計スコアに比例。係数は実装時に決める）。
- 送付先は `users.solana_address`。**ウォレット未連携のユーザーには配布しない**
  （連携後に遡って受け取れる導線は将来検討）。
- `token_awards` で `(user_id, season_id)` 一意にし、**二重配布を防ぐ**。
  送信は pending → sent/failed で記録し、失敗は再試行可能にする。

### ウォレット連携

- Google ログイン済みユーザーが、Solanaアドレスを登録する。
- なりすまし防止のため、**署名チャレンジで所有を確認**する
  （サーバーが nonce を発行 → ウォレットで署名 → ed25519 署名を検証）。
- 検証成功で `solana_address` / `wallet_verified_at` を設定する。

### 鍵・コスト・技術メモ

- mint 権限の秘密鍵は Cloudflare secret（`MINT_AUTHORITY_SECRET`）で保持。コミット禁止。
- 受信者ごとにトークンアカウント作成の rent（約 0.002 SOL）が treasury 負担で発生する。
- Workers から Solana RPC へ送信する。`@solana/web3.js` 等が Workers（`nodejs_compat`）で
  動くかを**実装前にスパイクで検証**する（重い場合は軽量実装に切替）。

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

ただし**予想時のアーティスト・曲選択は外部音楽DB（Spotify→MusicBrainz）を直接検索**する
（`GET /artists/external` / `GET /songs/external`、ログイン必須）。事前登録は不要で、
選択時に遅延アップサートでローカルへ取り込む。上記のローカル部分一致検索は一覧・管理用に残す。

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
    "message": "曲名は必須です", // 人間向けの説明
  },
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

## セットアップ / 環境

### バインディング（`wrangler.jsonc`）

- D1 / KV などのCloudflareリソースは `wrangler.jsonc` に定義し、`Env` 型で受け取る。
- D1: バインディング名 `DB`（コード内は `env.DB`）。
- セッションにKVを使う場合はKV名前空間を定義する。

### シークレット / 環境変数

- 秘密情報は **`wrangler secret put`** で登録する（本番）。
  ローカル開発では **`.dev.vars`** に置く。**どちらもコミットしない**。
- 必要なシークレット:
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`（Google OAuth）
  - `SESSION_SECRET`（Cookie / JWT 署名用）
  - `SOLANA_RPC_URL`（記念トークン用。Devnet RPC エンドポイント）
  - `TOKEN_MINT_ADDRESS`（発行する記念トークンの mint アドレス）
  - `MINT_AUTHORITY_SECRET`（mint 権限の秘密鍵。最重要・取扱注意）

### テスト

- テストランナーは **Vitest**（Vite前提のため）。
- スコアリング・早押し係数などの純粋ロジックは、DB非依存で単体テストできるよう分離する。
- D1/KV を絡める結合テストが必要な場合は **`@cloudflare/vitest-pool-workers`** を使う。

## AIエージェントへの指示

このプロジェクトを変更する際は:

1. まずこのファイルを読む。
2. シンプルで保守しやすい実装を優先する。
3. 理由なく新しいフレームワークを導入しない。
4. ブロックチェーン/トークンは原則追加しない。例外は譲渡不可の記念トークンのみ
   （[記念トークン](#記念トークンソウルバウンド)）。換金性・賭け用途は持たせない。
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
