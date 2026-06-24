// Cloudflare バインディング（wrangler.jsonc と対応）
export type Bindings = {
  DB: D1Database;
  // セッションにKVを使う場合に有効化する
  SESSIONS?: KVNamespace;
  // シークレット（wrangler secret / .dev.vars で設定）
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};
