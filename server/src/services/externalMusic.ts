// 外部音楽DB検索（管理者の登録補助）。
// 方針: Spotify を主に使い、結果が無い/未設定なら MusicBrainz にフォールバックする。
// 取り込むのは自分のDBに必要な最小限（名前・URL・リリース年など）のみ。
// パース部分は純関数にしてテスト可能にする（ネットワークは searchExternal* が担う）。

import type { Bindings } from "../types/env";

export type ExternalSource = "spotify" | "musicbrainz";

export type ExternalArtist = {
  source: ExternalSource;
  externalId: string;
  name: string;
  imageUrl: string | null;
  url: string | null;
  // ジャンルや国・補足など、候補を見分けるための短い説明
  detail: string | null;
};

export type ExternalTrack = {
  source: ExternalSource;
  externalId: string;
  title: string;
  artistName: string;
  releaseYear: number | null;
};

// MusicBrainz は User-Agent の明示が必須（アプリ名/連絡先）。
const MB_USER_AGENT =
  "kohaku-yoso/1.0 ( https://kohaku-yoso.haruocode.workers.dev )";

// ---- パース（純関数） ---------------------------------------------------

export function parseSpotifyArtists(json: unknown): ExternalArtist[] {
  const items = (json as { artists?: { items?: unknown[] } })?.artists?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    const a = raw as {
      id?: string;
      name?: string;
      genres?: string[];
      images?: { url?: string }[];
      external_urls?: { spotify?: string };
    };
    if (!a.id || !a.name) return [];
    const genres = Array.isArray(a.genres) ? a.genres.slice(0, 2).join(", ") : "";
    return [
      {
        source: "spotify" as const,
        externalId: a.id,
        name: a.name,
        imageUrl: a.images?.[0]?.url ?? null,
        url: a.external_urls?.spotify ?? null,
        detail: genres || null,
      },
    ];
  });
}

export function parseSpotifyTracks(json: unknown): ExternalTrack[] {
  const items = (json as { tracks?: { items?: unknown[] } })?.tracks?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    const t = raw as {
      id?: string;
      name?: string;
      artists?: { name?: string }[];
      album?: { release_date?: string };
    };
    if (!t.id || !t.name) return [];
    return [
      {
        source: "spotify" as const,
        externalId: t.id,
        title: t.name,
        artistName: t.artists?.[0]?.name ?? "",
        releaseYear: parseYear(t.album?.release_date),
      },
    ];
  });
}

export function parseMusicBrainzArtists(json: unknown): ExternalArtist[] {
  const list = (json as { artists?: unknown[] })?.artists;
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw) => {
    const a = raw as {
      id?: string;
      name?: string;
      country?: string;
      disambiguation?: string;
      type?: string;
    };
    if (!a.id || !a.name) return [];
    const detail = [a.type, a.country, a.disambiguation]
      .filter((s): s is string => Boolean(s))
      .join(" · ");
    return [
      {
        source: "musicbrainz" as const,
        externalId: a.id,
        name: a.name,
        imageUrl: null,
        url: `https://musicbrainz.org/artist/${a.id}`,
        detail: detail || null,
      },
    ];
  });
}

export function parseMusicBrainzTracks(json: unknown): ExternalTrack[] {
  const list = (json as { recordings?: unknown[] })?.recordings;
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw) => {
    const r = raw as {
      id?: string;
      title?: string;
      "artist-credit"?: { name?: string }[];
      "first-release-date"?: string;
    };
    if (!r.id || !r.title) return [];
    return [
      {
        source: "musicbrainz" as const,
        externalId: r.id,
        title: r.title,
        artistName: r["artist-credit"]?.[0]?.name ?? "",
        releaseYear: parseYear(r["first-release-date"]),
      },
    ];
  });
}

function parseYear(date: string | undefined): number | null {
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

// ---- ネットワーク -------------------------------------------------------

type Fetcher = typeof fetch;

function spotifyConfigured(env: Bindings): boolean {
  return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
}

async function getSpotifyToken(
  env: Bindings,
  fetchImpl: Fetcher,
): Promise<string | null> {
  const credentials = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const res = await fetchImpl("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string };
  return body.access_token ?? null;
}

async function spotifySearch(
  env: Bindings,
  type: "artist" | "track",
  query: string,
  limit: number,
  fetchImpl: Fetcher,
): Promise<unknown | null> {
  const token = await getSpotifyToken(env, fetchImpl);
  if (!token) return null;
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("market", "JP");
  const res = await fetchImpl(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function musicBrainzSearch(
  entity: "artist" | "recording",
  query: string,
  limit: number,
  fetchImpl: Fetcher,
): Promise<unknown | null> {
  const url = new URL(`https://musicbrainz.org/ws/2/${entity}`);
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", String(limit));
  const res = await fetchImpl(url.toString(), {
    headers: { "user-agent": MB_USER_AGENT, accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

/** アーティスト検索: Spotify を試し、空/未設定なら MusicBrainz にフォールバック */
export async function searchExternalArtists(
  env: Bindings,
  query: string,
  limit = 10,
  fetchImpl: Fetcher = fetch,
): Promise<ExternalArtist[]> {
  if (spotifyConfigured(env)) {
    const json = await spotifySearch(env, "artist", query, limit, fetchImpl);
    const results = json ? parseSpotifyArtists(json) : [];
    if (results.length > 0) return results;
  }
  const mb = await musicBrainzSearch("artist", query, limit, fetchImpl);
  return mb ? parseMusicBrainzArtists(mb) : [];
}

/** 曲検索: Spotify を試し、空/未設定なら MusicBrainz にフォールバック */
export async function searchExternalTracks(
  env: Bindings,
  query: string,
  limit = 10,
  fetchImpl: Fetcher = fetch,
): Promise<ExternalTrack[]> {
  if (spotifyConfigured(env)) {
    const json = await spotifySearch(env, "track", query, limit, fetchImpl);
    const results = json ? parseSpotifyTracks(json) : [];
    if (results.length > 0) return results;
  }
  const mb = await musicBrainzSearch("recording", query, limit, fetchImpl);
  return mb ? parseMusicBrainzTracks(mb) : [];
}
