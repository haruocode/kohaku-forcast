import { Hono } from "hono";
import { getDb } from "../db";
import { isAcceptingPredictions } from "../domain/season";
import { getCurrentSeason, listSeasons } from "../repositories/seasons";
import { errorBody } from "../lib/http";
import type { Bindings, Variables, } from "../types/env";
import type { Season } from "../repositories/seasons";

const seasons = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const withOpenFlag = (s: Season) => ({ ...s, isOpen: isAcceptingPredictions(s) });

// 現在のシーズン（受付中フラグ付き）
seasons.get("/current", async (c) => {
  const db = getDb(c.env.DB);
  const season = await getCurrentSeason(db);
  if (!season) {
    return c.json(errorBody("NOT_FOUND", "シーズンがありません"), 404);
  }
  return c.json(withOpenFlag(season));
});

// 一覧
seasons.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const rows = await listSeasons(db);
  return c.json(rows.map(withOpenFlag));
});

export default seasons;
