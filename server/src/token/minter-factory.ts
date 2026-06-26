import type { Minter } from "./minter";
import type { Bindings } from "../types/env";

/**
 * env が揃っていれば SolanaMinter を生成、未設定なら null（=配布機能オフ）。
 * Solanaライブラリ（重い・Node依存）は実際に配布する時だけ動的importして読み込む。
 * これによりテスト/通常の実行時はSolanaモジュールを読み込まない。
 */
export async function createMinterFromEnv(env: Bindings): Promise<Minter | null> {
  if (!env.SOLANA_RPC_URL || !env.TOKEN_MINT_ADDRESS || !env.MINT_AUTHORITY_SECRET) {
    return null;
  }
  const { SolanaMinter } = await import("./solana-minter");
  return new SolanaMinter(
    env.SOLANA_RPC_URL,
    env.TOKEN_MINT_ADDRESS,
    env.MINT_AUTHORITY_SECRET,
  );
}
