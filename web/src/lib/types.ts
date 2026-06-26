export type User = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  solanaAddress?: string | null;
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
};

export type RankingRow = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  hitCount: number;
};

export type WalletChallenge = { message: string; challenge: string };

export type TokenAward = {
  id: string;
  seasonId: string;
  seasonYear: number;
  amount: number;
  status: "pending" | "sent" | "failed";
  txSignature: string | null;
};
