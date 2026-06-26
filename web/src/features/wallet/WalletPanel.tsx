import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";
import { connectWallet, signMessage, getPhantom } from "../../lib/wallet";
import type { TokenAward, User, WalletChallenge } from "../../lib/types";

const statusLabel: Record<TokenAward["status"], string> = {
  sent: "送信済み ✅",
  pending: "送信待ち",
  failed: "失敗（再送待ち）",
};

function AwardsList() {
  const { data } = useQuery<TokenAward[]>({
    queryKey: ["wallet", "awards"],
    queryFn: () => apiGet<TokenAward[]>("/wallet/awards"),
  });

  if (!data || data.length === 0) {
    return <p className="muted">まだ獲得した記念トークンはありません。</p>;
  }
  return (
    <ul className="result-list">
      {data.map((a) => (
        <li key={a.id}>
          <span>
            {a.seasonYear} ｜ <strong>{a.amount} トークン</strong> ｜ {statusLabel[a.status]}
          </span>
          {a.txSignature && (
            <a
              href={`https://explorer.solana.com/tx/${a.txSignature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              tx
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

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

      <h3>獲得した記念トークン</h3>
      <AwardsList />
    </section>
  );
}
