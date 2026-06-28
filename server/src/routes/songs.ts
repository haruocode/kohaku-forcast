import { Hono } from "hono";
import { getDb } from "../db";
import { requireAuth } from "../auth/session";
import { searchSongs, clampLimit } from "../services/search";
import { searchExternalTracks } from "../services/externalMusic";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const songs = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 外部音楽DBでの曲検索（予想時に直接選ぶ用。Spotify→MusicBrainz）。ログイン必須。
songs.get("/external", requireAuth, async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) {
    return c.json(errorBody("VALIDATION_ERROR", "検索語 q が必要です"), 400);
  }
  const results = await searchExternalTracks(c.env, q);
  return c.json(results);
});

// 曲検索（ローカルDB）
songs.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) {
    return c.json(errorBody("VALIDATION_ERROR", "検索語 q が必要です"), 400);
  }
  const db = getDb(c.env.DB);
  const results = await searchSongs(db, q, clampLimit(c.req.query("limit")));
  return c.json(results);
});

export default songs;
