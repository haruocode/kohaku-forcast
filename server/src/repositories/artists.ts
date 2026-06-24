import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { artists } from "../db/schema";

export type Artist = typeof artists.$inferSelect;

export async function findArtistById(
  db: Db,
  id: string,
): Promise<Artist | undefined> {
  return db.select().from(artists).where(eq(artists.id, id)).get();
}
