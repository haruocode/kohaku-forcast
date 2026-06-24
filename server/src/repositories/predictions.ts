import { and, eq, desc } from "drizzle-orm";
import type { Db } from "../db";
import { predictions } from "../db/schema";
import type {
  CreatePredictionInput,
  UpdatePredictionInput,
} from "../schemas/predictions";

export type Prediction = typeof predictions.$inferSelect;

export async function findPredictionById(
  db: Db,
  id: string,
): Promise<Prediction | undefined> {
  return db.select().from(predictions).where(eq(predictions.id, id)).get();
}

/** 同一ユーザー・同一シーズン・同一アーティストの既存予想を返す（重複チェック用） */
export async function findDuplicate(
  db: Db,
  userId: string,
  seasonId: string,
  artistId: string,
): Promise<Prediction | undefined> {
  return db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.seasonId, seasonId),
        eq(predictions.artistId, artistId),
      ),
    )
    .get();
}

export async function createPrediction(
  db: Db,
  userId: string,
  input: CreatePredictionInput,
): Promise<Prediction> {
  return db
    .insert(predictions)
    .values({
      userId,
      seasonId: input.seasonId,
      artistId: input.artistId,
      songId: input.songId ?? null,
      confidence: input.confidence,
      comment: input.comment ?? null,
    })
    .returning()
    .get();
}

export async function updatePrediction(
  db: Db,
  id: string,
  patch: UpdatePredictionInput,
): Promise<Prediction> {
  const values: Partial<typeof predictions.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.songId !== undefined) values.songId = patch.songId;
  if (patch.confidence !== undefined) values.confidence = patch.confidence;
  if (patch.comment !== undefined) values.comment = patch.comment;

  return db
    .update(predictions)
    .set(values)
    .where(eq(predictions.id, id))
    .returning()
    .get();
}

export async function deletePrediction(db: Db, id: string): Promise<void> {
  await db.delete(predictions).where(eq(predictions.id, id)).run();
}

export async function listPredictions(
  db: Db,
  seasonId?: string,
): Promise<Prediction[]> {
  const base = db.select().from(predictions);
  const rows = seasonId
    ? await base.where(eq(predictions.seasonId, seasonId)).orderBy(desc(predictions.createdAt)).all()
    : await base.orderBy(desc(predictions.createdAt)).all();
  return rows;
}
