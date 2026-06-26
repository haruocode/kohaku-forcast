import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiSend, ApiError } from "../../lib/api";
import type { Artist, Song, Prediction, Season, User } from "../../lib/types";

function useSeason() {
  return useQuery<Season>({
    queryKey: ["season", "current"],
    queryFn: () => apiGet<Season>("/seasons/current"),
  });
}

function ArtistSearch({ onPick }: { onPick: (a: Artist) => void }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery<Artist[]>({
    queryKey: ["artists", "search", q],
    queryFn: () => apiGet<Artist[]>(`/artists/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });

  return (
    <div>
      <input
        placeholder="アーティスト名で検索（かな・別名・英語OK）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isFetching && <span className="muted"> 検索中…</span>}
      <ul className="result-list">
        {(data ?? []).map((a) => (
          <li key={a.id}>
            <button onClick={() => onPick(a)}>
              {a.name}
              {a.nameKana ? <span className="muted">（{a.nameKana}）</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PredictionForm({
  season,
  artist,
  onDone,
}: {
  season: Season;
  artist: Artist;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [songId, setSongId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [comment, setComment] = useState("");

  const { data: songs } = useQuery<Song[]>({
    queryKey: ["artist", artist.id, "songs"],
    queryFn: () => apiGet<Song[]>(`/artists/${artist.id}/songs`),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<Prediction>("/predictions", {
        seasonId: season.id,
        artistId: artist.id,
        songId,
        confidence,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
      onDone();
    },
  });

  return (
    <div className="card">
      <h3>{artist.name} を予想</h3>
      <label>
        歌う曲（任意・出場予想のみも可）
        <select
          value={songId ?? ""}
          onChange={(e) => setSongId(e.target.value || null)}
        >
          <option value="">（曲は予想しない）</option>
          {(songs ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        確信度: {confidence}
        <input
          type="range"
          min={1}
          max={5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
        />
      </label>
      <label>
        コメント
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <div className="row">
        <button disabled={create.isPending} onClick={() => create.mutate()}>
          予想する
        </button>
        <button className="ghost" onClick={onDone}>
          やめる
        </button>
      </div>
      {create.error instanceof ApiError && (
        <p className="error">{create.error.message}</p>
      )}
    </div>
  );
}

function PredictionList({ season, me }: { season: Season; me: User | null }) {
  const qc = useQueryClient();
  const { data } = useQuery<Prediction[]>({
    queryKey: ["predictions", season.id],
    queryFn: () => apiGet<Prediction[]>(`/predictions?seasonId=${season.id}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiSend<{ ok: boolean }>("DELETE", `/predictions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["predictions"] }),
  });

  return (
    <div>
      <h3>みんなの予想</h3>
      <ul className="result-list">
        {(data ?? []).map((p) => (
          <li key={p.id}>
            <span>
              artist:{p.artistId.slice(0, 6)} / 確信度{p.confidence}
              {p.comment ? ` / ${p.comment}` : ""}
            </span>
            {me && me.id === p.userId && season.isOpen && (
              <button className="ghost" onClick={() => remove.mutate(p.id)}>
                取消
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PredictionsPanel({ me }: { me: User | null }) {
  const { data: season, isLoading, error } = useSeason();
  const [artist, setArtist] = useState<Artist | null>(null);

  if (isLoading) return <p className="muted">読み込み中…</p>;
  if (error || !season)
    return <p className="muted">シーズンがまだありません（管理者の設定待ち）。</p>;

  return (
    <section className="panel">
      <h2>
        予想（{season.year}）{season.isOpen ? "" : "｜受付終了"}
      </h2>
      {!me ? (
        <p className="muted">予想するにはログインしてください。</p>
      ) : !season.isOpen ? (
        <p className="muted">この回の受付は終了しています。</p>
      ) : artist ? (
        <PredictionForm season={season} artist={artist} onDone={() => setArtist(null)} />
      ) : (
        <ArtistSearch onPick={setArtist} />
      )}
      <PredictionList season={season} me={me} />
    </section>
  );
}
