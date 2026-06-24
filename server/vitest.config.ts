import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  // vitest は server ディレクトリを cwd として実行される
  const migrations = await readD1Migrations("./drizzle");

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            // テスト専用のシークレット/値とマイグレーション一式
            bindings: {
              TEST_MIGRATIONS: migrations,
              SESSION_SECRET: "test-secret-please-change",
              GOOGLE_CLIENT_ID: "test-client-id",
              GOOGLE_CLIENT_SECRET: "test-client-secret",
            },
          },
        },
      },
    },
  };
});
