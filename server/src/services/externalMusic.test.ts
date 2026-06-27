import { describe, it, expect, vi } from "vitest";
import {
  parseSpotifyArtists,
  parseSpotifyTracks,
  parseMusicBrainzArtists,
  parseMusicBrainzTracks,
  searchExternalArtists,
  searchExternalTracks,
} from "./externalMusic";
import type { Bindings } from "../types/env";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("parseSpotifyArtists", () => {
  it("id/name/画像/URL/ジャンルを取り出す", () => {
    const out = parseSpotifyArtists({
      artists: {
        items: [
          {
            id: "abc",
            name: "YOASOBI",
            genres: ["j-pop", "anime", "extra"],
            images: [{ url: "https://img/1" }, { url: "https://img/2" }],
            external_urls: { spotify: "https://open.spotify.com/artist/abc" },
          },
        ],
      },
    });
    expect(out).toEqual([
      {
        source: "spotify",
        externalId: "abc",
        name: "YOASOBI",
        imageUrl: "https://img/1",
        url: "https://open.spotify.com/artist/abc",
        detail: "j-pop, anime",
      },
    ]);
  });

  it("id か name が欠けた項目は除外する", () => {
    const out = parseSpotifyArtists({
      artists: { items: [{ name: "noid" }, { id: "x" }] },
    });
    expect(out).toEqual([]);
  });

  it("想定外の形でも落ちずに空配列を返す", () => {
    expect(parseSpotifyArtists(null)).toEqual([]);
    expect(parseSpotifyArtists({})).toEqual([]);
  });
});

describe("parseSpotifyTracks", () => {
  it("曲名・アーティスト名・リリース年を取り出す", () => {
    const out = parseSpotifyTracks({
      tracks: {
        items: [
          {
            id: "t1",
            name: "アイドル",
            artists: [{ name: "YOASOBI" }],
            album: { release_date: "2023-04-12" },
          },
        ],
      },
    });
    expect(out).toEqual([
      {
        source: "spotify",
        externalId: "t1",
        title: "アイドル",
        artistName: "YOASOBI",
        releaseYear: 2023,
      },
    ]);
  });
});

describe("parseMusicBrainzArtists", () => {
  it("id/name/補足(type・国・曖昧さ回避)を取り出す", () => {
    const out = parseMusicBrainzArtists({
      artists: [
        {
          id: "mb1",
          name: "米津玄師",
          type: "Person",
          country: "JP",
          disambiguation: "ハチ",
        },
      ],
    });
    expect(out).toEqual([
      {
        source: "musicbrainz",
        externalId: "mb1",
        name: "米津玄師",
        imageUrl: null,
        url: "https://musicbrainz.org/artist/mb1",
        detail: "Person · JP · ハチ",
      },
    ]);
  });
});

describe("parseMusicBrainzTracks", () => {
  it("first-release-date から年を取り出す", () => {
    const out = parseMusicBrainzTracks({
      recordings: [
        {
          id: "r1",
          title: "Lemon",
          "artist-credit": [{ name: "米津玄師" }],
          "first-release-date": "2018-03-14",
        },
      ],
    });
    expect(out[0]).toMatchObject({
      source: "musicbrainz",
      title: "Lemon",
      artistName: "米津玄師",
      releaseYear: 2018,
    });
  });
});

const spotifyEnv = {
  SPOTIFY_CLIENT_ID: "id",
  SPOTIFY_CLIENT_SECRET: "secret",
} as unknown as Bindings;
const noSpotifyEnv = {} as unknown as Bindings;

describe("searchExternalArtists (フォールバック)", () => {
  it("Spotifyに結果があればMusicBrainzは呼ばない", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "tok" })) // token
      .mockResolvedValueOnce(
        json({ artists: { items: [{ id: "a", name: "Ado" }] } }),
      );
    const out = await searchExternalArtists(spotifyEnv, "ado", 10, fetchImpl);
    expect(out[0]?.source).toBe("spotify");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("Spotifyが0件ならMusicBrainzにフォールバックする", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "tok" }))
      .mockResolvedValueOnce(json({ artists: { items: [] } }))
      .mockResolvedValueOnce(json({ artists: [{ id: "mb", name: "Ado" }] }));
    const out = await searchExternalArtists(spotifyEnv, "ado", 10, fetchImpl);
    expect(out[0]?.source).toBe("musicbrainz");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("Spotify未設定ならMusicBrainzのみ叩く", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ artists: [{ id: "mb", name: "Ado" }] }));
    const out = await searchExternalArtists(noSpotifyEnv, "ado", 10, fetchImpl);
    expect(out[0]?.source).toBe("musicbrainz");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("searchExternalTracks (フォールバック)", () => {
  it("Spotify未設定ならMusicBrainz recording を叩く", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        json({ recordings: [{ id: "r", title: "Lemon" }] }),
      );
    const out = await searchExternalTracks(noSpotifyEnv, "lemon", 10, fetchImpl);
    expect(out[0]).toMatchObject({ source: "musicbrainz", title: "Lemon" });
  });
});
