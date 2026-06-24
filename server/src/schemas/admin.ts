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
