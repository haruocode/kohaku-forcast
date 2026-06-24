import type { Db } from "../db";
import { matchesQuery, matchesAny } from "../domain/search";
import {
  listArtistsWithAliases,
  type ArtistWithAliases,
} from "../repositories/artists";
import {
  listSongsWithArtist,
  type SongWithArtist,
} from "../repositories/songs";

export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;

export function clampLimit(raw: string | undefined): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_SEARCH_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SEARCH_LIMIT;
  return Math.min(n, MAX_SEARCH_LIMIT);
}

/**
 * アーティストを部分一致で検索する（name / name_kana / 別名）。
 * D1に類似検索が無いため候補を読み込んでアプリ側で正規化照合する。
 * 紅白規模ではデータ件数が小さいため許容（将来はFTS5や正規化列を検討）。
 */
export async function searchArtists(
  db: Db,
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Promise<ArtistWithAliases[]> {
  const all = await listArtistsWithAliases(db);
  const hit = all.filter(
    (a) =>
      matchesQuery(a.name, query) ||
      (a.nameKana ? matchesQuery(a.nameKana, query) : false) ||
      matchesAny(a.aliases, query),
  );
  return hit.slice(0, limit);
}

/** 曲を部分一致で検索する（title / title_kana） */
export async function searchSongs(
  db: Db,
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Promise<SongWithArtist[]> {
  const all = await listSongsWithArtist(db);
  const hit = all.filter(
    (s) =>
      matchesQuery(s.title, query) ||
      (s.titleKana ? matchesQuery(s.titleKana, query) : false),
  );
  return hit.slice(0, limit);
}
