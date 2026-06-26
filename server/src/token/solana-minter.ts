import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  type Signer,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import type { Minter } from "./minter";

// WebSocket購読を避け、RPCポーリングで確認する（Workers向け。スパイクで検証済み）。
async function sendAndPoll(
  conn: Connection,
  tx: Transaction,
  payer: Keypair,
  signers: Signer[],
): Promise<string> {
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer, ...signers);
  const sig = await conn.sendRawTransaction(tx.serialize());
  for (let i = 0; i < 30; i++) {
    const st = await conn.getSignatureStatus(sig);
    if (st.value?.err) throw new Error(`tx failed: ${JSON.stringify(st.value.err)}`);
    const s = st.value?.confirmationStatus;
    if (s === "confirmed" || s === "finalized") return sig;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("confirmation timeout");
}

/**
 * Token-2022 の譲渡不可トークンを mint する送信器。
 * 受信者ATAは冪等命令で用意するため、再送でも安全。
 */
export class SolanaMinter implements Minter {
  private conn: Connection;
  private authority: Keypair;
  private mint: PublicKey;

  constructor(rpcUrl: string, mintAddress: string, authoritySecretBase58: string) {
    this.conn = new Connection(rpcUrl, "confirmed");
    this.authority = Keypair.fromSecretKey(bs58.decode(authoritySecretBase58));
    this.mint = new PublicKey(mintAddress);
  }

  async mintTo(address: string, amount: number): Promise<string> {
    const recipient = new PublicKey(address);
    const ata = getAssociatedTokenAddressSync(
      this.mint,
      recipient,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        this.authority.publicKey,
        ata,
        recipient,
        this.mint,
        TOKEN_2022_PROGRAM_ID,
      ),
      createMintToInstruction(
        this.mint,
        ata,
        this.authority.publicKey,
        BigInt(amount),
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );
    return sendAndPoll(this.conn, tx, this.authority, []);
  }
}
