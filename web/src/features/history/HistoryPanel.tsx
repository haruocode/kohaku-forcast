import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";
import type { LedgerEntry, LedgerReason, User } from "../../lib/types";

const REASON_LABEL: Record<LedgerReason, string> = {
  signup: "初回登録ボーナス",
  daily: "ログインボーナス",
  bet: "予想（賭け）",
  payout: "的中配当",
  refund: "返金",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryPanel({ me }: { me: User | null }) {
  const { data, isLoading } = useQuery<LedgerEntry[]>({
    queryKey: ["points-history"],
    queryFn: () => apiGet<LedgerEntry[]>("/points/history"),
    enabled: !!me,
  });

  if (!me) {
    return (
      <section className="panel">
        <h2>ポイント履歴</h2>
        <p className="muted">ログインすると履歴が表示されます。</p>
      </section>
    );
  }

  const rows = data ?? [];

  return (
    <section className="panel">
      <h2>ポイント履歴</h2>
      <p className="muted">現在の所持ポイント: 🏅 {me.points} pt</p>
      {isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : rows.length === 0 ? (
        <p className="muted">まだ履歴がありません。</p>
      ) : (
        <table className="ranking history">
          <thead>
            <tr>
              <th>日時</th>
              <th>内容</th>
              <th>増減</th>
              <th>残高</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{formatDate(r.createdAt)}</td>
                <td>{REASON_LABEL[r.reason] ?? r.reason}</td>
                <td className={r.delta >= 0 ? "settled-win" : "settled-lose"}>
                  {r.delta >= 0 ? "+" : ""}
                  {r.delta}
                </td>
                <td>{r.balanceAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
