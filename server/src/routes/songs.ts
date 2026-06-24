import { Hono } from "hono";
import { getDb } from "../db";
import { searchSongs, clampLimit } from "../services/search";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const songs = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 曲検索
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
