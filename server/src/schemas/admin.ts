import { z } from "zod";

// 締切操作: 公式発表の日時を設定する（過去日時も可）
export const closeSeasonSchema = z.object({
  announcedAt: z.string().datetime(),
});

// 結果確定: シーズンの各アーティストの出場可否と歌唱曲をまとめて確定する
export const confirmResultsSchema = z.object({
  seasonId: z.string().min(1),
  entries: z
    .array(
      z.object({
        artistId: z.string().min(1),
        appeared: z.boolean(),
        songId: z.string().min(1).nullable().optional(),
      }),
    )
    .min(1),
});

export type ConfirmResultsInput = z.infer<typeof confirmResultsSchema>;

// シーズン作成
export const createSeasonSchema = z.object({
  year: z.number().int().min(1950).max(2100),
  title: z.string().min(1).optional(),
  predictionOpenAt: z.string().datetime().optional(),
});

// アーティスト作成（別名も同時に登録可能）
export const createArtistSchema = z.object({
  name: z.string().min(1),
  nameKana: z.string().min(1).optional(),
  genderGroup: z.string().min(1).optional(),
  officialUrl: z.string().url().optional(),
  aliases: z.array(z.string().min(1)).optional(),
});

// 曲作成
export const createSongSchema = z.object({
  artistId: z.string().min(1),
  title: z.string().min(1),
  titleKana: z.string().min(1).optional(),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type CreateArtistInput = z.infer<typeof createArtistSchema>;
export type CreateSongInput = z.infer<typeof createSongSchema>;
