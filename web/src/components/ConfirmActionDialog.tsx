export type ConfirmActionDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "danger" | "neutral" | "success";
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  tone = "neutral",
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
  if (!open) {
    return null;
  }

  const confirmClasses =
    tone === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700"
      : tone === "success"
        ? "bg-emerald-600 text-white hover:bg-emerald-700"
        : "bg-slate-900 text-white hover:bg-slate-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${confirmClasses}`}
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
