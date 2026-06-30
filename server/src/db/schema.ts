import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// 共通方針（AGENTS.md）:
// - id は UUID 文字列（crypto.randomUUID() で発番）
// - 日時は UTC の ISO8601 文字列
// - 真偽値は INTEGER(0/1)（drizzle の mode: "boolean" で扱う）

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  text("created_at").notNull().$defaultFn(() => new Date().toISOString());
const updatedAt = () =>
  text("updated_at").notNull().$defaultFn(() => new Date().toISOString());

export const users = sqliteTable("users", {
  id: id(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  // Google の sub クレーム（不変のユーザー識別子。メールより優先して照合する）
  googleSub: text("google_sub").notNull().unique(),
  avatarUrl: text("avatar_url"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  // 所持ポイント残高（ベット通貨）。増減は必ず point_ledger に記録する。
  points: integer("points").notNull().default(0),
  // 日次ログインボーナスを最後に受け取った日（JST基準の YYYY-MM-DD）。二重付与防止。
  lastDailyBonusDate: text("last_daily_bonus_date"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ポイントの入出金台帳。残高(users.points)の全変動を1行ずつ記録する監査ログ。
// reason: signup（初回付与）/ daily（日次ボーナス）/ bet（予想で消費）
//        / payout（的中配当）/ refund（取消・編集での返金）
export const pointLedger = sqliteTable("point_ledger", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // 増減量（付与・配当・返金は正、ベット消費は負）
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  // この変動の適用後残高（履歴表示用のスナップショット）
  balanceAfter: integer("balance_after").notNull(),
  // 関連する予想id（bet / payout / refund のとき）。それ以外は NULL
  refId: text("ref_id"),
  note: text("note"),
  createdAt: createdAt(),
});

export const artists = sqliteTable(
  "artists",
  {
    id: id(),
    name: text("name").notNull(),
    nameKana: text("name_kana"),
    genderGroup: text("gender_group"),
    officialUrl: text("official_url"),
    // 外部音楽DB由来の識別。ユーザーが外部から直接選んだとき遅延アップサートで設定する。
    // 手動登録（管理者）の行は両方 NULL。SQLite では NULL 同士は別物なので重複しない。
    source: text("source"),
    externalId: text("external_id"),
    imageUrl: text("image_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // 同一の外部アーティストは1行に集約する（重複登録の防止）
    uniqueIndex("artists_source_external_unq").on(t.source, t.externalId),
  ],
);

// 別名（例: 米津玄師 = ハチ / Kenshi Yonezu）。別名でも部分一致検索できるよう1行ずつ持つ。
export const artistAliases = sqliteTable("artist_aliases", {
  id: id(),
  artistId: text("artist_id")
    .notNull()
    .references(() => artists.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const songs = sqliteTable(
  "songs",
  {
    id: id(),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    titleKana: text("title_kana"),
    releaseYear: integer("release_year"),
    // 外部音楽DB由来の識別（artists と同じ方針。手動登録は両方 NULL）。
    source: text("source"),
    externalId: text("external_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("songs_source_external_unq").on(t.source, t.externalId),
  ],
);

export const seasons = sqliteTable("seasons", {
  id: id(),
  year: integer("year").notNull().unique(),
  title: text("title"),
  predictionOpenAt: text("prediction_open_at"),
  // NULL = 受付中。締切操作で運営が「公式発表の日時」を設定する（過去日時も可）。
  predictionCloseAt: text("prediction_close_at"),
  resultConfirmedAt: text("result_confirmed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const predictions = sqliteTable(
  "predictions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    // nullable: 「出場予想のみ（曲は予想しない）」を許可する
    songId: text("song_id").references(() => songs.id, { onDelete: "set null" }),
    // 旧: 自信度1〜5。ベット制移行で未使用（互換のため nullable 列として残置）。
    confidence: integer("confidence"),
    // 賭け額（ポイント）。作成時に残高から消費する。範囲は API の Zod で検証する。
    stake: integer("stake").notNull().default(0),
    // 精算済みフラグ。結果確定後の配当付与を一度だけにする冪等性キー。
    settled: integer("settled", { mode: "boolean" }).notNull().default(false),
    // 精算で得た配当（的中なら正、外れは0）。未精算は NULL。
    payout: integer("payout"),
    comment: text("comment"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // 同一ユーザーが同一シーズンで同じアーティストを二重予想できない
    uniqueIndex("predictions_user_season_artist_unq").on(
      t.userId,
      t.seasonId,
      t.artistId,
    ),
  ],
);

export const results = sqliteTable(
  "results",
  {
    id: id(),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    appeared: integer("appeared", { mode: "boolean" }).notNull(),
    // appeared = false のときは NULL
    songId: text("song_id").references(() => songs.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // 同一シーズン・同一アーティストの結果は1行のみ
    uniqueIndex("results_season_artist_unq").on(t.seasonId, t.artistId),
  ],
);
