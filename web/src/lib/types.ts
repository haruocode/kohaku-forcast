export type User = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  /** 所持ポイント残高 */
  points: number;
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
  /** 賭け額 */
  stake: number;
  settled?: boolean;
  payout?: number | null;
  comment: string | null;
  createdAt: string;
  // 一覧APIが付与する表示用フィールド
  artistName?: string;
  songTitle?: string | null;
  displayName?: string;
  // 残高更新系APIが付与する
  balanceAfter?: number;
};

export type RankingRow = {
  rank: number;
  userId: string;
  displayName: string;
  /** overall は残高、season は純損益 */
  score: number;
  // season ランキングのみ
  staked?: number;
  won?: number;
  hitCount?: number;
};

export type MyPoints = {
  score: number;
  rank: number | null;
  totalUsers: number;
};

export type LedgerReason = "signup" | "daily" | "bet" | "payout" | "refund";

export type LedgerEntry = {
  id: string;
  userId: string;
  delta: number;
  reason: LedgerReason;
  balanceAfter: number;
  refId: string | null;
  note: string | null;
  createdAt: string;
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
