import { Hono } from "hono";
import type { ZodSchema } from "zod";
import { getDb } from "../db";
import { requireAuth } from "../auth/session";
import { isAcceptingPredictions } from "../domain/season";
import { findSeasonById } from "../repositories/seasons";
import { findArtistById } from "../repositories/artists";
import {
  createPrediction,
  updatePrediction,
  deletePrediction,
  findPredictionById,
  findDuplicate,
  listPredictions,
} from "../repositories/predictions";
import {
  createPredictionSchema,
  updatePredictionSchema,
} from "../schemas/predictions";
import { errorBody } from "../lib/http";
import type { Bindings, Variables } from "../types/env";

const predictions = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/** JSONボディをZodで検証し、成功なら data、失敗なら null を返す */
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

// 予想の投稿
predictions.post("/", requireAuth, async (c) => {
  const parsed = await parseBody(c, createPredictionSchema);
  if ("message" in parsed) {
    return c.json(errorBody("VALIDATION_ERROR", parsed.message), 400);
  }
  const input = parsed.data;
  const db = getDb(c.env.DB);

  const season = await findSeasonById(db, input.seasonId);
  if (!season) {
    return c.json(errorBody("NOT_FOUND", "シーズンが見つかりません"), 404);
  }
  if (!isAcceptingPredictions(season)) {
    return c.json(errorBody("SEASON_CLOSED", "予想の受付は終了しています"), 403);
  }

  const artist = await findArtistById(db, input.artistId);
  if (!artist) {
    return c.json(errorBody("NOT_FOUND", "アーティストが見つかりません"), 404);
  }

  const userId = c.get("userId");
  const duplicate = await findDuplicate(db, userId, input.seasonId, input.artistId);
  if (duplicate) {
    return c.json(
      errorBody("CONFLICT", "このアーティストの予想は既に登録されています"),
      409,
    );
  }

  const created = await createPrediction(db, userId, input);
  return c.json(created, 201);
});

// 予想の一覧（公開）。?seasonId= で絞り込み可
predictions.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const seasonId = c.req.query("seasonId");
  const rows = await listPredictions(db, seasonId);
  return c.json(rows);
});

// 予想の編集（受付中・本人のみ）
predictions.put("/:id", requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const existing = await findPredictionById(db, c.req.param("id"));
  if (!existing) {
    return c.json(errorBody("NOT_FOUND", "予想が見つかりません"), 404);
  }
  if (existing.userId !== c.get("userId")) {
    return c.json(errorBody("FORBIDDEN", "他人の予想は変更できません"), 403);
  }

  const season = await findSeasonById(db, existing.seasonId);
  if (season && !isAcceptingPredictions(season)) {
    return c.json(errorBody("SEASON_CLOSED", "予想の受付は終了しています"), 403);
  }

  const parsed = await parseBody(c, updatePredictionSchema);
  if ("message" in parsed) {
    return c.json(errorBody("VALIDATION_ERROR", parsed.message), 400);
  }

  const updated = await updatePrediction(db, existing.id, parsed.data);
  return c.json(updated);
});

// 予想の取消（受付中・本人のみ）
predictions.delete("/:id", requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const existing = await findPredictionById(db, c.req.param("id"));
  if (!existing) {
    return c.json(errorBody("NOT_FOUND", "予想が見つかりません"), 404);
  }
  if (existing.userId !== c.get("userId")) {
    return c.json(errorBody("FORBIDDEN", "他人の予想は取消できません"), 403);
  }

  const season = await findSeasonById(db, existing.seasonId);
  if (season && !isAcceptingPredictions(season)) {
    return c.json(errorBody("SEASON_CLOSED", "予想の受付は終了しています"), 403);
  }

  await deletePrediction(db, existing.id);
  return c.json({ ok: true });
});

export default predictions;
