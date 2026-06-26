import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "../../lib/api";
import type { RankingRow, Season } from "../../lib/types";

export function RankingsPanel() {
  const { data: season } = useQuery<Season>({
    queryKey: ["season", "current"],
    queryFn: () => apiGet<Season>("/seasons/current"),
  });

  const { data, error, isLoading } = useQuery<RankingRow[]>({
    queryKey: ["rankings", season?.id],
    queryFn: () => apiGet<RankingRow[]>(`/rankings/${season!.id}`),
    enabled: !!season,
  });

  return (
    <section className="panel">
      <h2>ランキング</h2>
      {!season ? (
        <p className="muted">シーズンがありません。</p>
      ) : isLoading ? (
        <p className="muted">集計中…</p>
      ) : error instanceof ApiError && error.code === "CONFLICT" ? (
        <p className="muted">結果確定後に表示されます（締切前）。</p>
      ) : (
        <table className="ranking">
          <thead>
            <tr>
              <th>順位</th>
              <th>ユーザー</th>
              <th>スコア</th>
              <th>的中</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.userId}>
                <td>{r.rank}</td>
                <td>{r.displayName}</td>
                <td>{r.score}</td>
                <td>{r.hitCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
