import { Hono } from "hono";
import type { ZodSchema } from "zod";
import { getDb } from "../db";
import { requireAdmin } from "../auth/admin";
import { findSeasonById, closeSeason, createSeason } from "../repositories/seasons";
import { createArtist, findArtistById } from "../repositories/artists";
import { createSong } from "../repositories/songs";
import { upsertResults } from "../repositories/results";
import { settleSeason } from "../services/settlement";
import { listAllLedger } from "../repositories/points";
import {
  searchExternalArtists,
  searchExternalTracks,
} from "../services/externalMusic";
import {
  closeSeasonSchema,
  confirmResultsSchema,
  createSeasonSchema,
  createArtistSchema,
  createSongSchema,
} from "../schemas/admin";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function parseBody<T>(
  c: { req: { json: () => Promise<unknown> } },
  schema: ZodSchema<T>,
): Promise<{ data: T } | { message: string }> {
  const raw = await c.req.json().catch(() => null);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { message: result.error.issues[0]?.message ?? "入力が不正です" };
  }
  return { data: result.data };
}

admin.use("*", requireAdmin);

// 締切操作: 公式発表の日時を設定する
admin.post("/seasons/:id/close", async (c) => {
  const parsed = await parseBody(c, closeSeasonSchema);
  if ("message" in parsed) {
    return c.json(errorBody("VALIDATION_ERROR", parsed.message), 400);
  }
  const db = getDb(c.env.DB);
  const season = await findSeasonById(db, c.req.param("id"));
  if (!season) {
    return c.json(errorBody("NOT_FOUND", "シーズンが見つかりません"), 404);
  }
  const updated = await closeSeason(db, season.id, parsed.data.announcedAt);
  return c.json(updated);
});

// 結果確定: 出場可否・歌唱曲をまとめて確定する
admin.post("/results", async (c) => {
  const parsed = await parseBody(c, confirmResultsSchema);
  if ("message" in parsed) {
    return c.json(errorBody("VALIDATION_ERROR", parsed.message), 400);
  }
  const db = getDb(c.env.DB);
  const season = await findSeasonById(db, parsed.data.seasonId);
  if (!season) {
    return c.json(errorBody("NOT_FOUND", "シーズンが見つかりません"), 404);
  }
  await upsertResults(db, parsed.data.seasonId, parsed.data.entries);
  return c.json({ ok: true, count: parsed.data.entries.length });
});

// 精算: 結果確定後、未精算の予想に配当を付与する（settled で冪等）。締切済みのみ。
admin.post("/seasons/:id/settle", async (c) => {
  const db = getDb(c.env.DB);
  const season = await findSeasonById(db, c.req.param("id"));
  if (!season) {
    return c.json(errorBody("NOT_FOUND", "シーズンが見つかりません"), 404);
  }
  if (season.predictionCloseAt === null) {
    return c.json(
      errorBody("CONFLICT", "締切前のシーズンは精算できません"),
      409,
    );
  }
  const summary = await settleSeason(db, season);
  return c.json({ ok: true, ...summary });
});

// 全ユーザーのポイント履歴（いつ・誰に・何ポイント・理由）。新しい順。
admin.get("/points/ledger", async (c) => {
  const db = getDb(c.env.DB);
  const limit = Number(c.req.query("limit") ?? 200);
  const rows = await listAllLedger(db, Number.isFinite(limit) ? limit : 200);
  return c.json(rows);
});

// シーズン作成
admin.post("/seasons", async (c) => {
  const parsed = await parseBody(c, createSeasonSchema);
  if ("message" in parsed) {
    return c.json(errorBody("VALIDATION_ERROR", parsed.message), 400);
  }
  const season = await createSeason(getDb(c.env.DB), parsed.data);
  return c.json(season, 201);
});

// 外部音楽DBでアーティストを検索（Spotify→MusicBrainzフォールバック）
admin.get("/external/artists", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) {
    return c.json(errorBody("VALIDATION_ERROR", "検索語 q が必要です"), 400);
  }
  const results = await searchExternalArtists(c.env, q);
  return c.json(results);
});

// 外部音楽DBで曲を検索（Spotify→MusicBrainzフォールバック）
admin.get("/external/tracks", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) {
    return c.json(errorBody("VALIDATION_ERROR", "検索語 q が必要です"), 400);
  }
  const results = await searchExternalTracks(c.env, q);
  return c.json(results);
});

// アーティスト作成（別名も同時に登録可能）
admin.post("/artists", async (c) => {
  const parsed = await parseBody(c, createArtistSchema);
  if ("message" in parsed) {
    return c.json(errorBody("VALIDATION_ERROR", parsed.message), 400);
  }
  const artist = await createArtist(getDb(c.env.DB), parsed.data);
  return c.json(artist, 201);
});

// 曲作成
admin.post("/songs", async (c) => {
  const parsed = await parseBody(c, createSongSchema);
  if ("message" in parsed) {
    return c.json(errorBody("VALIDATION_ERROR", parsed.message), 400);
  }
  const db = getDb(c.env.DB);
  const artist = await findArtistById(db, parsed.data.artistId);
  if (!artist) {
    return c.json(errorBody("NOT_FOUND", "アーティストが見つかりません"), 404);
  }
  const song = await createSong(db, parsed.data);
  return c.json(song, 201);
});

export default admin;
