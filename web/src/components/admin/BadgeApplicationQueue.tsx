import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";

import { ApiError, api, type BadgeAppRecord } from "../../lib/api";
import { clampPage, getPageCount, paginate } from "../../lib/pagination";
import { InlineNotice } from "../InlineNotice";
import { PaginationControls } from "../PaginationControls";

const BADGE_QUEUE_PAGE_SIZE = 5;

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type ReviewDialogState = {
  application: BadgeAppRecord;
  status: "approved" | "denied";
  decisionNotes: string;
};

function applicationStatusClasses(status: string): string {
  if (status === "approved") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "denied") {
    return "bg-rose-100 text-rose-700 border-rose-200";
  }

  return "bg-blue-200 text-blue-800 border-blue-300";
}

function applicationStatusLabel(status: string): string {
  if (status === "approved") return "Approved";
  if (status === "denied") return "Denied";
  return "Submitted";
}

export function BadgeApplicationQueue() {
  const queryClient = useQueryClient();

  const badgeApps = useQuery({ queryKey: ["admin-badge-apps"], queryFn: api.getBadgeApps });
  const [notice, setNotice] = useState<NoticeState>(null);
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(null);
  const [page, setPage] = useState(0);

  const sortedApplications = (badgeApps.data?.applications ?? []).slice().sort((a, b) => {
    if (a.status === "submitted" && b.status !== "submitted") return -1;
    if (a.status !== "submitted" && b.status === "submitted") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalPages = getPageCount(sortedApplications.length, BADGE_QUEUE_PAGE_SIZE);
  const visibleApplications = paginate(sortedApplications, page, BADGE_QUEUE_PAGE_SIZE);

  useEffect(() => {
    setPage((currentPage) =>
      clampPage(currentPage, sortedApplications.length, BADGE_QUEUE_PAGE_SIZE),
    );
  }, [sortedApplications.length]);

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      decisionNotes,
    }: {
      id: string;
      status: "approved" | "denied";
      decisionNotes?: string;
    }) => api.reviewBadgeApp(id, { status, decisionNotes }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-badge-apps"] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      setReviewDialog(null);

      setNotice({
        tone: "success",
        message:
          variables.status === "approved"
            ? "Application approved. The badge will appear on that user's events."
            : "Application denied.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof ApiError ? error.message : "Could not review the badge application.",
      });
    },
  });

  function confirmReview() {
    if (!reviewDialog) return;

    reviewMutation.mutate({
      id: reviewDialog.application.id,
      status: reviewDialog.status,
      decisionNotes: reviewDialog.decisionNotes.trim() || undefined,
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldAlert size={20} />
            Badge application queue
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Review submitted trust badge applications in manageable pages.
          </p>
        </div>
        <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
          {sortedApplications.length} total
        </span>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

      {badgeApps.error instanceof ApiError ? (
        <div className="mt-4">
          <InlineNotice tone="error">{badgeApps.error.message}</InlineNotice>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {visibleApplications.map((application) => (
          <article
            className={`rounded-2xl border p-5 ${
              application.status === "submitted"
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
            key={application.id}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className="block text-sm font-bold text-slate-900">
                  {application.applicantName ?? "Unknown applicant"}
                </span>
                {application.applicantEmail ? (
                  <span className="block text-xs text-slate-500">
                    {application.applicantEmail}
                  </span>
                ) : null}
                <span className="mt-1 block text-xs font-medium text-slate-500">
                  Submitted {new Date(application.createdAt).toLocaleDateString()}
                </span>
              </div>

              <span
                className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${applicationStatusClasses(
                  application.status,
                )}`}
              >
                {applicationStatusLabel(application.status)}
              </span>
            </div>

            <p className="mb-1 border-t border-slate-200/50 pt-2 text-xs font-bold text-slate-700">
              Requested: {application.badgeName}
            </p>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm italic leading-relaxed text-slate-700">
              "{application.message}"
            </div>

            {application.decisionNotes ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
                <span className="font-bold text-slate-800">Decision notes:</span>{" "}
                {application.decisionNotes}
              </div>
            ) : null}

            {application.status === "submitted" ? (
              <div className="mt-4 flex gap-2">
                <button
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    setReviewDialog({
                      application,
                      status: "approved",
                      decisionNotes: "",
                    })
                  }
                  type="button"
                >
                  <CheckCircle2 size={16} />
                  Approve
                </button>
                <button
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-rose-600 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    setReviewDialog({
                      application,
                      status: "denied",
                      decisionNotes: "",
                    })
                  }
                  type="button"
                >
                  <XCircle size={16} />
                  Deny
                </button>
              </div>
            ) : null}
          </article>
        ))}

        {sortedApplications.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No applications in queue.</p>
        ) : null}
      </div>

      <PaginationControls
        currentPage={page}
        itemLabel="applications"
        onPageChange={setPage}
        pageSize={BADGE_QUEUE_PAGE_SIZE}
        totalItems={sortedApplications.length}
        totalPages={totalPages}
      />

      {reviewDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">
              {reviewDialog.status === "approved" ? "Approve application?" : "Deny application?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review request for {reviewDialog.application.badgeName} from{" "}
              {reviewDialog.application.applicantName ?? "this student"}.
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              "{reviewDialog.application.message}"
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Decision notes
            </label>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              maxLength={1000}
              onChange={(event) =>
                setReviewDialog((current) =>
                  current ? { ...current, decisionNotes: event.target.value } : current,
                )
              }
              placeholder="Optional note for the student or admin record."
              value={reviewDialog.decisionNotes}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={reviewMutation.isPending}
                onClick={() => setReviewDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  reviewDialog.status === "approved"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
                disabled={reviewMutation.isPending}
                onClick={confirmReview}
                type="button"
              >
                {reviewMutation.isPending
                  ? "Saving..."
                  : reviewDialog.status === "approved"
                    ? "Approve"
                    : "Deny"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
