import { z } from "zod";
import { MIN_BET } from "../config/points";

const externalSource = z.enum(["spotify", "musicbrainz"]);

const stakeSchema = z
  .number()
  .int("賭け額は整数で指定してください")
  .min(MIN_BET, `賭け額は${MIN_BET}ポイント以上にしてください`);

// ユーザーが外部音楽DB（Spotify / MusicBrainz）から直接選んだアーティスト。
// サーバー側で (source, external_id) をキーにローカルへ遅延アップサートする。
const externalArtistSchema = z.object({
  source: externalSource,
  externalId: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

// 外部から選んだ曲（任意。出場予想のみも可）。
const externalTrackSchema = z.object({
  source: externalSource,
  externalId: z.string().min(1),
  title: z.string().min(1),
  releaseYear: z.number().int().nullable().optional(),
});

// 予想の作成。曲は任意（出場予想のみも可）。
export const createPredictionSchema = z.object({
  seasonId: z.string().min(1),
  artist: externalArtistSchema,
  song: externalTrackSchema.nullable().optional(),
  stake: stakeSchema,
  comment: z.string().max(500).optional(),
});

// 予想の編集。アーティスト・シーズンは変更不可。最低1項目が必要。
// song は外部選択 or null（曲予想を外す）。
export const updatePredictionSchema = z
  .object({
    song: externalTrackSchema.nullable().optional(),
    stake: stakeSchema.optional(),
    comment: z.string().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "更新する項目がありません",
  });

export type CreatePredictionInput = z.infer<typeof createPredictionSchema>;
export type UpdatePredictionInput = z.infer<typeof updatePredictionSchema>;
