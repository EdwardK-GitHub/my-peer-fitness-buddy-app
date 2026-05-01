import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock3, ShieldCheck } from "lucide-react";

import { InlineNotice } from "../components/InlineNotice";
import { ApiError, api, type BadgeAppRecord } from "../lib/api";

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

function statusClasses(status: string): string {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "denied") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function statusText(status: string): string {
  if (status === "approved") return "Approved";
  if (status === "denied") return "Denied";
  return "Submitted";
}

export function BadgesPage() {
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [selectedBadge, setSelectedBadge] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const badgeTypes = useQuery({ queryKey: ["badge-types"], queryFn: api.getBadgeTypes });

  const myApplications = useQuery({
    queryKey: ["my-badge-applications"],
    queryFn: api.getMyBadgeApps,
    enabled: session.data?.authenticated === true,
  });

  const applications = myApplications.data?.applications ?? [];

  const latestApplicationByBadgeId = useMemo(() => {
    const lookup = new Map<string, BadgeAppRecord>();

    for (const application of applications) {
      const existing = lookup.get(application.badgeTypeId);
      const applicationTime = new Date(application.createdAt).getTime();
      const existingTime = existing ? new Date(existing.createdAt).getTime() : -1;

      if (!existing || applicationTime > existingTime) {
        lookup.set(application.badgeTypeId, application);
      }
    }

    return lookup;
  }, [applications]);

  const selectedBadgeType = badgeTypes.data?.badgeTypes.find((badge) => badge.id === selectedBadge);
  const selectedApplication = selectedBadge
    ? latestApplicationByBadgeId.get(selectedBadge)
    : undefined;

  const applicationAlreadyOpen = selectedApplication?.status === "submitted";
  const badgeAlreadyApproved = selectedApplication?.status === "approved";
  const submissionBlocked = applicationAlreadyOpen || badgeAlreadyApproved;

  const submitMutation = useMutation({
    mutationFn: api.submitBadgeApp,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-badge-applications"] });
      setNotice({ tone: "success", message: "Application submitted. Status: Submitted." });
      setMessage("");
      setSelectedBadge("");
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Could not submit your badge application.",
      });
    },
  });

  function openApplicationForm(badgeId: string) {
    if (!session.data?.authenticated) {
      setNotice({ tone: "info", message: "Sign in before applying for a trust badge." });
      return;
    }

    setSelectedBadge(badgeId);
    setMessage("");
    setNotice(null);
  }

  function submitApplication() {
    if (!selectedBadge) {
      setNotice({ tone: "error", message: "Choose a badge before submitting the application." });
      return;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setNotice({ tone: "error", message: "Explain why you qualify before submitting." });
      return;
    }

    if (submissionBlocked) {
      setNotice({
        tone: "info",
        message: applicationAlreadyOpen
          ? "You already have a submitted application for this badge."
          : "You already have this approved trust badge.",
      });
      return;
    }

    submitMutation.mutate({
      badgeTypeId: selectedBadge,
      message: trimmedMessage,
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4 rounded-3xl bg-white p-8 shadow-sm">
        <div className="rounded-2xl bg-amber-100 p-3">
          <ShieldCheck className="text-amber-600" size={32} />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
            Trust badges
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900">Apply for credibility badges</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Submit a badge application for admin review. Approved badges appear on events you host
            so other students can recognize trusted peers.
          </p>
        </div>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

      {badgeTypes.error instanceof ApiError ? (
        <InlineNotice tone="error">{badgeTypes.error.message}</InlineNotice>
      ) : null}

      {myApplications.error instanceof ApiError ? (
        <InlineNotice tone="error">{myApplications.error.message}</InlineNotice>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          {badgeTypes.data?.badgeTypes.map((badge) => {
            const application = latestApplicationByBadgeId.get(badge.id);
            const selected = selectedBadge === badge.id;

            return (
              <article
                className={`rounded-3xl border p-6 shadow-sm transition ${
                  selected
                    ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200"
                    : "border-slate-200 bg-white hover:border-amber-200"
                }`}
                key={badge.id}
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{badge.displayName}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{badge.description}</p>
                  </div>

                  {application ? (
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                        application.status,
                      )}`}
                    >
                      {statusText(application.status)}
                    </span>
                  ) : null}
                </div>

                <button
                  className={`mt-5 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    selected
                      ? "bg-amber-200 text-amber-900"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                  onClick={() => openApplicationForm(badge.id)}
                  type="button"
                >
                  {application?.status === "approved"
                    ? "Approved"
                    : application?.status === "submitted"
                      ? "Application submitted"
                      : selected
                        ? "Selected"
                        : "Apply for this badge"}
                </button>
              </article>
            );
          })}

          {badgeTypes.data?.badgeTypes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-bold text-slate-900">No active badges available</h3>
              <p className="mt-2 text-sm text-slate-600">
                Badge types will appear here after admins enable them.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="h-fit rounded-3xl bg-slate-900 p-8 text-white shadow-lg md:sticky md:top-6">
          {session.data?.authenticated ? (
            selectedBadgeType ? (
              <div className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold">
                    <ShieldCheck size={20} />
                    Submit application
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    You are applying for{" "}
                    <span className="font-bold text-white">{selectedBadgeType.displayName}</span>.
                    Admins will manually review your explanation.
                  </p>
                </div>

                {selectedApplication ? (
                  <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses(selectedApplication.status)}`}>
                    Latest status: {statusText(selectedApplication.status)}
                  </div>
                ) : null}

                <textarea
                  className="h-44 w-full resize-none rounded-2xl border border-slate-700 bg-slate-800 p-4 text-sm text-white outline-none focus:border-blue-400"
                  maxLength={2000}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Briefly explain your relevant fitness experience, safety habits, or why you should receive this badge."
                  value={message}
                />

                <p className="text-xs text-slate-400">{message.length}/2000 characters</p>

                <button
                  className="w-full rounded-xl bg-white py-4 font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={submitMutation.isPending || !message.trim() || submissionBlocked}
                  onClick={submitApplication}
                  type="button"
                >
                  {submitMutation.isPending
                    ? "Submitting..."
                    : submissionBlocked
                      ? "Submission unavailable"
                      : "Submit to admin"}
                </button>

                <button
                  className="w-full rounded-xl border border-slate-600 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                  disabled={submitMutation.isPending}
                  onClick={() => {
                    setSelectedBadge("");
                    setMessage("");
                    setNotice(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center text-center">
                <Clock3 className="text-slate-500" size={28} />
                <p className="mt-3 text-sm font-medium text-slate-300">
                  Select a badge from the list to start an application.
                </p>
              </div>
            )
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <ShieldCheck className="text-slate-500" size={28} />
              <p className="mt-3 text-sm font-medium text-slate-300">
                Sign in to apply for trust badges.
              </p>
              <Link
                className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900"
                to="/login"
              >
                User sign in
              </Link>
            </div>
          )}
        </aside>
      </div>

      {session.data?.authenticated ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">My applications</h3>
          <p className="mt-1 text-sm text-slate-600">
            Track the review status of your trust badge applications.
          </p>

          <div className="mt-5 space-y-3">
            {applications.map((application) => (
              <article
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                key={application.id}
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-bold text-slate-900">{application.badgeName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {new Date(application.createdAt).toLocaleString()}
                    </p>
                    {application.reviewedAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Reviewed {new Date(application.reviewedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <span
                    className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                      application.status,
                    )}`}
                  >
                    {statusText(application.status)}
                  </span>
                </div>

                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm leading-6 text-slate-600">
                  {application.message}
                </p>
              </article>
            ))}

            {applications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm text-slate-500">No applications yet.</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
