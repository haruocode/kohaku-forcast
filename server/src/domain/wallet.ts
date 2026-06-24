import nacl from "tweetnacl";
import bs58 from "bs58";

// ウォレット所有確認（DB非依存）。ed25519署名を tweetnacl で検証する。

const SOLANA_PUBKEY_BYTES = 32;
const ED25519_SIG_BYTES = 64;

/** base58の文字列が32バイトのSolana公開鍵として妥当か */
export function isValidSolanaAddress(address: string): boolean {
  try {
    return bs58.decode(address).length === SOLANA_PUBKEY_BYTES;
  } catch {
    return false;
  }
}

/** 連携時に署名してもらうメッセージ（nonceを埋め込む） */
export function buildWalletChallengeMessage(nonce: string): string {
  return `Kohaku Forecast wallet link\nnonce: ${nonce}`;
}

/**
 * address（base58公開鍵）が message に対して signature（base58）を
 * 正しく署名しているか検証する。
 */
export function verifyWalletSignature(
  address: string,
  message: string,
  signatureBase58: string,
): boolean {
  let pubkey: Uint8Array;
  let signature: Uint8Array;
  try {
    pubkey = bs58.decode(address);
    signature = bs58.decode(signatureBase58);
  } catch {
    return false;
  }
  if (pubkey.length !== SOLANA_PUBKEY_BYTES) return false;
  if (signature.length !== ED25519_SIG_BYTES) return false;

  const msg = new TextEncoder().encode(message);
  return nacl.sign.detached.verify(msg, signature, pubkey);
}
