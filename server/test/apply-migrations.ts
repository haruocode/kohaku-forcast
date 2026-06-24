import { applyD1Migrations, env } from "cloudflare:test";

// 各テスト分離環境のD1へ、drizzleが生成したマイグレーションを適用する
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
