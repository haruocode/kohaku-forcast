import { and, eq } from "drizzle-orm";
import type { Db } from "../db";
import { songs, artists } from "../db/schema";

export type Song = typeof songs.$inferSelect;

/** 外部音楽DBの曲1件を表す最小情報（遅延アップサート用） */
export type ExternalTrackRef = {
  source: string;
  externalId: string;
  title: string;
  releaseYear?: number | null;
};

/** アーティスト名を添えた曲（検索・表示用） */
export type SongWithArtist = Song & { artistName: string };

export async function findSongById(
  db: Db,
  id: string,
): Promise<Song | undefined> {
  return db.select().from(songs).where(eq(songs.id, id)).get();
}

export async function createSong(
  db: Db,
  input: { artistId: string; title: string; titleKana?: string; releaseYear?: number },
): Promise<Song> {
  return db
    .insert(songs)
    .values({
      artistId: input.artistId,
      title: input.title,
      titleKana: input.titleKana ?? null,
      releaseYear: input.releaseYear ?? null,
    })
    .returning()
    .get();
}

/**
 * 外部の曲をローカルへ解決する（find-or-create）。
 * (source, external_id) で既存を引き、無ければ解決済みのローカルアーティスト配下に作成する。
 */
export async function resolveExternalSong(
  db: Db,
  artistId: string,
  ref: ExternalTrackRef,
): Promise<Song> {
  const existing = await db
    .select()
    .from(songs)
    .where(
      and(eq(songs.source, ref.source), eq(songs.externalId, ref.externalId)),
    )
    .get();
  if (existing) return existing;

  return db
    .insert(songs)
    .values({
      artistId,
      title: ref.title,
      releaseYear: ref.releaseYear ?? null,
      source: ref.source,
      externalId: ref.externalId,
    })
    .returning()
    .get();
}

/** あるアーティストの曲一覧 */
export async function listSongsByArtist(
  db: Db,
  artistId: string,
): Promise<Song[]> {
  return db
    .select()
    .from(songs)
    .where(eq(songs.artistId, artistId))
    .orderBy(songs.title)
    .all();
}

/** 全曲にアーティスト名を添えて返す */
export async function listSongsWithArtist(
  db: Db,
): Promise<SongWithArtist[]> {
  const rows = await db
    .select({
      id: songs.id,
      artistId: songs.artistId,
      title: songs.title,
      titleKana: songs.titleKana,
      releaseYear: songs.releaseYear,
      source: songs.source,
      externalId: songs.externalId,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
      artistName: artists.name,
    })
    .from(songs)
    .innerJoin(artists, eq(songs.artistId, artists.id))
    .orderBy(songs.title)
    .all();
  return rows;
}
