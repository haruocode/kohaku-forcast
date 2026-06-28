import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "../hooks/useMe";
import { apiPost, apiSend, ApiError, loginUrl } from "../lib/api";
import type { User } from "../lib/types";

export function AuthBar() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const logout = async () => {
    await apiPost("/auth/logout");
    // ユーザー依存のキャッシュを捨ててから、me を即 null にして画面を確実に切り替える
    // （再フェッチ任せにせず、タイミング依存をなくす）。
    qc.clear();
    qc.setQueryData(["me"], null);
  };

  const save = useMutation({
    mutationFn: (displayName: string) =>
      apiSend<User>("PATCH", "/auth/me", { displayName }),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      // 予想一覧などに出る表示名も更新する
      qc.invalidateQueries({ queryKey: ["predictions"] });
      setEditing(false);
    },
  });

  const startEdit = () => {
    setName(me?.displayName ?? "");
    save.reset();
    setEditing(true);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) save.mutate(trimmed);
  };

  return (
    <header className="authbar">
      <span className="brand">紅白出場者予想アプリ</span>
      {isLoading ? (
        <span className="muted">…</span>
      ) : me ? (
        <span className="authbar-right">
          {me.avatarUrl && <img className="avatar" src={me.avatarUrl} alt="" />}
          {editing ? (
            <span className="name-edit">
              <input
                className="name-input"
                value={name}
                maxLength={50}
                autoFocus
                placeholder="表示名"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <button
                className="btn-sm"
                disabled={save.isPending || !name.trim()}
                onClick={submit}
              >
                {save.isPending ? "保存中…" : "保存"}
              </button>
              <button className="ghost btn-sm" onClick={() => setEditing(false)}>
                やめる
              </button>
              {save.error instanceof ApiError && (
                <span className="error">{save.error.message}</span>
              )}
            </span>
          ) : (
            <button className="name-btn" onClick={startEdit} title="表示名を変更">
              {me.displayName} <span className="edit-pencil">✎</span>
            </button>
          )}
          <button onClick={logout}>ログアウト</button>
        </span>
      ) : (
        <a className="btn" href={loginUrl}>
          Googleでログイン
        </a>
      )}
    </header>
  );
}
