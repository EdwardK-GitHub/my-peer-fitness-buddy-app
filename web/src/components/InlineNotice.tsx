import type { ReactNode } from "react";

type NoticeTone = "success" | "error" | "info";

const toneClasses: Record<NoticeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function InlineNotice({
  tone,
  children,
}: {
  tone: NoticeTone;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}
