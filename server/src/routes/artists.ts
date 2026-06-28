import { Hono } from "hono";
import { getDb } from "../db";
import { requireAuth } from "../auth/session";
import { listArtists, findArtistById } from "../repositories/artists";
import { listSongsByArtist } from "../repositories/songs";
import { searchArtists, clampLimit } from "../services/search";
import { searchExternalArtists } from "../services/externalMusic";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const artists = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 外部音楽DBでのアーティスト検索（予想時に直接選ぶ用。Spotify→MusicBrainz）。
// 外部APIのクォータ保護のためログイン必須。/:id より前に登録する。
artists.get("/external", requireAuth, async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) {
    return c.json(errorBody("VALIDATION_ERROR", "検索語 q が必要です"), 400);
  }
  const results = await searchExternalArtists(c.env, q);
  return c.json(results);
});

// アーティスト検索（ローカルDB。/:id より前に登録する）
artists.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) {
    return c.json(errorBody("VALIDATION_ERROR", "検索語 q が必要です"), 400);
  }
  const db = getDb(c.env.DB);
  const results = await searchArtists(db, q, clampLimit(c.req.query("limit")));
  return c.json(results);
});

// アーティストの曲一覧（予想時の曲選択用）
artists.get("/:id/songs", async (c) => {
  const db = getDb(c.env.DB);
  const artist = await findArtistById(db, c.req.param("id"));
  if (!artist) {
    return c.json(errorBody("NOT_FOUND", "アーティストが見つかりません"), 404);
  }
  return c.json(await listSongsByArtist(db, artist.id));
});

// アーティスト一覧
artists.get("/", async (c) => {
  const db = getDb(c.env.DB);
  return c.json(await listArtists(db));
});

export default artists;
