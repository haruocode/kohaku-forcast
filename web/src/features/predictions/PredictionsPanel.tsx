import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiSend, ApiError, loginUrl } from "../../lib/api";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type {
  ExternalArtist,
  ExternalTrack,
  Prediction,
  Season,
  User,
} from "../../lib/types";

function useSeason() {
  return useQuery<Season>({
    queryKey: ["season", "current"],
    queryFn: () => apiGet<Season>("/seasons/current"),
  });
}

function ArtistSearch({ onPick }: { onPick: (a: ExternalArtist) => void }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery<ExternalArtist[]>({
    queryKey: ["artists", "external", q],
    queryFn: () =>
      apiGet<ExternalArtist[]>(`/artists/external?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });

  return (
    <div>
      <input
        placeholder="アーティスト名で検索"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isFetching && <span className="muted"> 検索中…</span>}
      <ul className="result-list">
        {(data ?? []).map((a) => (
          <li key={`${a.source}:${a.externalId}`}>
            <button className="result-pick" onClick={() => onPick(a)}>
              {a.imageUrl ? (
                <img className="result-thumb" src={a.imageUrl} alt="" />
              ) : (
                <span className="result-thumb thumb-placeholder">♪</span>
              )}
              <span>{a.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SongSearch({
  artist,
  selected,
  onSelect,
}: {
  artist: ExternalArtist;
  selected: ExternalTrack | null;
  onSelect: (t: ExternalTrack | null) => void;
}) {
  const [q, setQ] = useState(artist.name);
  const { data, isFetching } = useQuery<ExternalTrack[]>({
    queryKey: ["songs", "external", q],
    queryFn: () =>
      apiGet<ExternalTrack[]>(`/songs/external?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  });

  if (selected) {
    return (
      <div className="row">
        <span>
          🎵 {selected.title}
          {selected.releaseYear ? (
            <span className="muted">（{selected.releaseYear}）</span>
          ) : null}
        </span>
        <button className="ghost" onClick={() => onSelect(null)}>
          曲を変える
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        placeholder="曲名で検索（任意・出場予想のみも可）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isFetching && <span className="muted"> 検索中…</span>}
      <ul className="result-list">
        {(data ?? []).map((t) => (
          <li key={`${t.source}:${t.externalId}`}>
            <button onClick={() => onSelect(t)}>
              {t.title}
              <span className="muted">
                {" "}
                · {t.artistName}
                {t.releaseYear ? `（${t.releaseYear}）` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MIN_BET = 10;

function PredictionForm({
  season,
  artist,
  me,
  onDone,
}: {
  season: Season;
  artist: ExternalArtist;
  me: User;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [song, setSong] = useState<ExternalTrack | null>(null);
  const [stake, setStake] = useState(100);
  const [comment, setComment] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiPost<Prediction>("/predictions", {
        seasonId: season.id,
        artist,
        song,
        stake,
        comment: comment || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-points"] });
      onDone();
    },
  });

  const invalid =
    !Number.isFinite(stake) || stake < MIN_BET || stake > me.points;

  return (
    <div className="card">
      <h3>{artist.name} に賭ける</h3>
      <label>
        歌う曲（任意・出場予想のみも可）
        <SongSearch artist={artist} selected={song} onSelect={setSong} />
      </label>
      <label>
        賭け額（ポイント）
        <input
          type="number"
          min={MIN_BET}
          max={me.points}
          step={10}
          value={stake}
          onChange={(e) => setStake(Math.floor(Number(e.target.value)))}
        />
      </label>
      <p className="muted bet-hint">
        所持 {me.points} pt ・ 出場的中で ×2、曲も的中で ×4（早押しで最大 ×1.5）
        {stake >= MIN_BET && stake <= me.points ? (
          <>
            {" "}
            ｜的中なら最大 <strong>{stake * 4}</strong> pt
          </>
        ) : null}
      </p>
      <label>
        コメント
        <input value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <div className="row">
        <button disabled={create.isPending || invalid} onClick={() => create.mutate()}>
          {stake > me.points ? "残高不足" : "この額で賭ける"}
        </button>
        <button className="ghost" onClick={onDone}>
          やめる
        </button>
      </div>
      {stake > me.points && (
        <p className="error">所持ポイントを超えています（所持 {me.points} pt）。</p>
      )}
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

  const [pendingDelete, setPendingDelete] = useState<Prediction | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => apiSend<{ ok: boolean }>("DELETE", `/predictions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-points"] });
      setPendingDelete(null);
    },
  });

  const list = data ?? [];

  return (
    <div>
      <h3>みんなの予想</h3>
      {list.length === 0 ? (
        <p className="muted">まだ予想がありません。</p>
      ) : (
        <ul className="prediction-list">
          {list.map((p) => {
            const mine = !!me && me.id === p.userId;
            const removing = remove.isPending && remove.variables === p.id;
            return (
              <li key={p.id} className="prediction-item">
                <div className="prediction-body">
                  <div className="prediction-head">
                    <span className="prediction-artist">
                      {p.artistName ?? "（不明なアーティスト）"}
                    </span>
                    {p.songTitle ? (
                      <span className="prediction-song">🎵 {p.songTitle}</span>
                    ) : (
                      <span className="prediction-song muted">出場予想のみ</span>
                    )}
                  </div>
                  <div className="prediction-meta muted">
                    <span className="bet-chip" title="賭け額">
                      💰 {p.stake} pt
                    </span>
                    {p.settled ? (
                      <span
                        className={p.payout && p.payout > 0 ? "settled-win" : "settled-lose"}
                      >
                        {p.payout && p.payout > 0 ? `的中 +${p.payout}` : "外れ"}
                      </span>
                    ) : null}
                    <span>
                      {p.displayName ?? "匿名"}
                      {mine ? "（あなた）" : ""}
                    </span>
                    {p.comment ? <span>「{p.comment}」</span> : null}
                  </div>
                </div>
                {mine && season.isOpen && (
                  <button
                    className="ghost danger cancel-btn"
                    disabled={removing}
                    onClick={() => setPendingDelete(p)}
                  >
                    {removing ? "取消中…" : "取り消す"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="予想を取り消しますか？"
        description={
          pendingDelete
            ? `「${pendingDelete.artistName ?? "この予想"}」の予想を取り消します。この操作は元に戻せません。`
            : ""
        }
        confirmLabel="取り消す"
        cancelLabel="やめる"
        destructive
        busy={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export function PredictionsPanel({ me }: { me: User | null }) {
  const { data: season, isLoading, error } = useSeason();
  const [artist, setArtist] = useState<ExternalArtist | null>(null);

  if (isLoading) return <p className="muted">読み込み中…</p>;
  if (error || !season)
    return <p className="muted">シーズンがまだありません（管理者の設定待ち）。</p>;

  return (
    <section className="panel">
      <h2>
        予想（{season.year}）{season.isOpen ? "" : "｜受付終了"}
      </h2>
      {!me ? (
        <p className="muted">
          予想には<a href={loginUrl}>ログイン</a>してください。
        </p>
      ) : !season.isOpen ? (
        <p className="muted">この回の受付は終了しています。</p>
      ) : artist ? (
        <PredictionForm
          season={season}
          artist={artist}
          me={me}
          onDone={() => setArtist(null)}
        />
      ) : (
        <ArtistSearch onPick={setArtist} />
      )}
      <PredictionList season={season} me={me} />
    </section>
  );
}
