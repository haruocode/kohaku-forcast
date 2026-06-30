import { Hono } from "hono";
import type { ZodSchema } from "zod";
import { getDb } from "../db";
import { requireAuth } from "../auth/session";
import { isAcceptingPredictions } from "../domain/season";
import { findSeasonById } from "../repositories/seasons";
import { resolveExternalArtist } from "../repositories/artists";
import { resolveExternalSong } from "../repositories/songs";
import {
  createPredictionWithStake,
  updatePrediction,
  deletePrediction,
  findPredictionById,
  findDuplicate,
  listPredictionsDetailed,
} from "../repositories/predictions";
import {
  applyPointChange,
  InsufficientPointsError,
} from "../repositories/points";
import { findUserById } from "../repositories/users";
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

  // 外部選択をローカルへ解決（find-or-create）。採点は常にローカルidで回る。
  const artist = await resolveExternalArtist(db, input.artist);

  const userId = c.get("userId");
  const duplicate = await findDuplicate(db, userId, input.seasonId, artist.id);
  if (duplicate) {
    return c.json(
      errorBody("CONFLICT", "このアーティストの予想は既に登録されています"),
      409,
    );
  }

  const song = input.song
    ? await resolveExternalSong(db, artist.id, input.song)
    : null;

  const user = await findUserById(db, userId);
  if (!user) {
    return c.json(errorBody("NOT_FOUND", "ユーザーが見つかりません"), 404);
  }

  try {
    const { prediction, balanceAfter } = await createPredictionWithStake(
      db,
      userId,
      {
        seasonId: input.seasonId,
        artistId: artist.id,
        songId: song?.id ?? null,
        stake: input.stake,
        comment: input.comment,
      },
      user.points,
    );
    return c.json({ ...prediction, balanceAfter }, 201);
  } catch (e) {
    if (e instanceof InsufficientPointsError) {
      return c.json(errorBody("INSUFFICIENT_POINTS", e.message), 400);
    }
    throw e;
  }
});

// 予想の一覧（公開）。?seasonId= で絞り込み可
predictions.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const seasonId = c.req.query("seasonId");
  const rows = await listPredictionsDetailed(db, seasonId);
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
  const patch = parsed.data;

  // song が指定されていれば既存アーティスト配下にローカル解決する（null は曲予想を外す）
  let songId: string | null | undefined;
  if (patch.song !== undefined) {
    songId = patch.song
      ? (await resolveExternalSong(db, existing.artistId, patch.song)).id
      : null;
  }

  // 賭け額を変更する場合は差分を残高に反映する（増額は消費・減額は返金）。
  let balanceAfter: number | undefined;
  if (patch.stake !== undefined && patch.stake !== existing.stake) {
    const delta = patch.stake - existing.stake; // 正=増額
    try {
      balanceAfter = await applyPointChange(
        db,
        existing.userId,
        -delta,
        delta > 0 ? "bet" : "refund",
        { refId: existing.id, note: "賭け額変更" },
      );
    } catch (e) {
      if (e instanceof InsufficientPointsError) {
        return c.json(errorBody("INSUFFICIENT_POINTS", e.message), 400);
      }
      throw e;
    }
  }

  const updated = await updatePrediction(db, existing.id, {
    songId,
    stake: patch.stake,
    comment: patch.comment,
  });
  return c.json({ ...updated, balanceAfter });
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
  // 賭け額を返金する（取消）。
  const balanceAfter = await applyPointChange(
    db,
    existing.userId,
    existing.stake,
    "refund",
    { refId: existing.id, note: "予想取消" },
  );
  return c.json({ ok: true, balanceAfter });
});

export default predictions;
