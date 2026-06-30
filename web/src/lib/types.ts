export type User = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export type Season = {
  id: string;
  year: number;
  title: string | null;
  predictionCloseAt: string | null;
  isOpen: boolean;
};

export type Artist = {
  id: string;
  name: string;
  nameKana: string | null;
  aliases?: string[];
};

export type Song = {
  id: string;
  artistId: string;
  title: string;
  titleKana: string | null;
};

export type Prediction = {
  id: string;
  userId: string;
  seasonId: string;
  artistId: string;
  songId: string | null;
  confidence: number;
  comment: string | null;
  createdAt: string;
  // 一覧APIが付与する表示用フィールド
  artistName?: string;
  songTitle?: string | null;
  displayName?: string;
};

export type RankingRow = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  hitCount: number;
};

export type ExternalSource = "spotify" | "musicbrainz";

export type ExternalArtist = {
  source: ExternalSource;
  externalId: string;
  name: string;
  imageUrl: string | null;
  url: string | null;
  detail: string | null;
};

export type ExternalTrack = {
  source: ExternalSource;
  externalId: string;
  title: string;
  artistName: string;
  releaseYear: number | null;
};
