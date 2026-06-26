// Cloudflare バインディング（wrangler.jsonc と対応）
export type Bindings = {
  DB: D1Database;
  // セッションにKVを使う場合に有効化する
  SESSIONS?: KVNamespace;
  // シークレット（wrangler secret / .dev.vars で設定）
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  // OAuth コールバックURL。未設定ならリクエストのオリジンから導出する。
  // 開発時は .dev.vars に http://localhost:5173/api/auth/google/callback を設定する。
  OAUTH_REDIRECT_URI?: string;
  // ログイン完了後にリダイレクトする先（既定: "/"）
  POST_LOGIN_REDIRECT?: string;
  // 記念トークン配布用（未設定なら配布機能は無効）
  SOLANA_RPC_URL?: string;
  TOKEN_MINT_ADDRESS?: string;
  MINT_AUTHORITY_SECRET?: string; // base58のsecret key
};

// 認証済みリクエストで参照するコンテキスト変数
export type Variables = {
  userId: string;
};
