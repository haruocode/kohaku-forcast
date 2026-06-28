import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 破壊的操作なら確認ボタンを赤系にする */
  destructive?: boolean;
  /** 確認ボタンの処理中フラグ（無効化＋ラベル差し替え用） */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** shadcn/radix 風の確認ダイアログ。ブラウザ標準の confirm() の置き換え。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="dialog-title">{title}</h3>
        {description && <p className="dialog-desc">{description}</p>}
        <div className="dialog-actions">
          <button className="btn-neutral" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={destructive ? "danger-solid" : ""}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "処理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
