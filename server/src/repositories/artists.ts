import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { artists, artistAliases } from "../db/schema";

export type Artist = typeof artists.$inferSelect;

/** 別名一覧を添えたアーティスト（検索・表示用） */
export type ArtistWithAliases = Artist & { aliases: string[] };

export async function findArtistById(
  db: Db,
  id: string,
): Promise<Artist | undefined> {
  return db.select().from(artists).where(eq(artists.id, id)).get();
}

export async function listArtists(db: Db): Promise<Artist[]> {
  return db.select().from(artists).orderBy(artists.name).all();
}

export async function createArtist(
  db: Db,
  input: {
    name: string;
    nameKana?: string;
    genderGroup?: string;
    officialUrl?: string;
    aliases?: string[];
  },
): Promise<Artist> {
  const artist = await db
    .insert(artists)
    .values({
      name: input.name,
      nameKana: input.nameKana ?? null,
      genderGroup: input.genderGroup ?? null,
      officialUrl: input.officialUrl ?? null,
    })
    .returning()
    .get();

  if (input.aliases && input.aliases.length > 0) {
    await db
      .insert(artistAliases)
      .values(input.aliases.map((alias) => ({ artistId: artist.id, alias })))
      .run();
  }
  return artist;
}

/** 全アーティストに別名配列をまとめて添えて返す */
export async function listArtistsWithAliases(
  db: Db,
): Promise<ArtistWithAliases[]> {
  const [rows, aliases] = await Promise.all([
    db.select().from(artists).orderBy(artists.name).all(),
    db.select().from(artistAliases).all(),
  ]);

  const byArtist = new Map<string, string[]>();
  for (const a of aliases) {
    const list = byArtist.get(a.artistId) ?? [];
    list.push(a.alias);
    byArtist.set(a.artistId, list);
  }

  return rows.map((r) => ({ ...r, aliases: byArtist.get(r.id) ?? [] }));
}
