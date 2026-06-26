import bs58 from "bs58";

// Phantom（window.solana）連携の最小ラッパー。
type PhantomProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

export function getPhantom(): PhantomProvider | null {
  const p = window.solana;
  return p && p.isPhantom ? p : null;
}

/** ウォレット接続してアドレス（base58）を返す */
export async function connectWallet(): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom ウォレットが見つかりません");
  const res = await phantom.connect();
  return res.publicKey.toString();
}

/** メッセージに署名し、署名（base58）を返す */
export async function signMessage(message: string): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom ウォレットが見つかりません");
  const encoded = new TextEncoder().encode(message);
  const { signature } = await phantom.signMessage(encoded, "utf8");
  return bs58.encode(signature);
}
