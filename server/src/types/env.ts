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
};

// 認証済みリクエストで参照するコンテキスト変数
export type Variables = {
  userId: string;
};
