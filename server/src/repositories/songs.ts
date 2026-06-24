import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { songs, artists } from "../db/schema";

export type Song = typeof songs.$inferSelect;

/** アーティスト名を添えた曲（検索・表示用） */
export type SongWithArtist = Song & { artistName: string };

export async function findSongById(
  db: Db,
  id: string,
): Promise<Song | undefined> {
  return db.select().from(songs).where(eq(songs.id, id)).get();
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
