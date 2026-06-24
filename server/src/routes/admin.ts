import { Hono } from "hono";
import type { ZodSchema } from "zod";
import { getDb } from "../db";
import { requireAdmin } from "../auth/admin";
import { findSeasonById, closeSeason } from "../repositories/seasons";
import { upsertResults } from "../repositories/results";
import { closeSeasonSchema, confirmResultsSchema } from "../schemas/admin";
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

export default admin;
