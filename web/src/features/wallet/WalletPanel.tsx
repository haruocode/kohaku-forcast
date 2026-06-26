import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "../../lib/api";
import { connectWallet, signMessage, getPhantom } from "../../lib/wallet";
import type { User, WalletChallenge } from "../../lib/types";

export function WalletPanel({ me }: { me: User | null }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!me) return null;

  const link = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const address = await connectWallet();
      const challenge = await apiPost<WalletChallenge>("/wallet/challenge");
      const signature = await signMessage(challenge.message);
      await apiPost("/wallet/link", {
        address,
        signature,
        challenge: challenge.challenge,
      });
      setStatus("ウォレットを連携しました 🎉");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "連携に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2>記念トークン用ウォレット</h2>
      {me.solanaAddress ? (
        <p className="muted">連携済み: {me.solanaAddress}</p>
      ) : !getPhantom() ? (
        <p className="muted">
          Phantom ウォレットが見つかりません（インストールが必要です）。
        </p>
      ) : (
        <button disabled={busy} onClick={link}>
          {busy ? "連携中…" : "ウォレットを連携する"}
        </button>
      )}
      {status && <p className="note">{status}</p>}
    </section>
  );
}
