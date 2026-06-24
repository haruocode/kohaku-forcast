import { z } from "zod";

// 予想の作成。曲は任意（出場予想のみも可）。
export const createPredictionSchema = z.object({
  seasonId: z.string().min(1),
  artistId: z.string().min(1),
  songId: z.string().min(1).nullable().optional(),
  confidence: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// 予想の編集。アーティスト・シーズンは変更不可。最低1項目が必要。
export const updatePredictionSchema = z
  .object({
    songId: z.string().min(1).nullable().optional(),
    confidence: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "更新する項目がありません",
  });

export type CreatePredictionInput = z.infer<typeof createPredictionSchema>;
export type UpdatePredictionInput = z.infer<typeof updatePredictionSchema>;
