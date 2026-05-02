import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MapPin, Pencil, Plus, ShieldAlert, Trash2, XCircle } from "lucide-react";

import { ConfirmActionDialog } from "../components/ConfirmActionDialog";
import { InlineNotice } from "../components/InlineNotice";
import { ApiError, api, type BadgeAppRecord, type Facility } from "../lib/api";

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type FacilityDialogState =
  | {
      mode: "create";
      id?: never;
      name: string;
      addressLine: string;
      description: string;
    }
  | {
      mode: "edit";
      id: string;
      name: string;
      addressLine: string;
      description: string;
    };

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

function emptyFacilityDialog(): FacilityDialogState {
  return {
    mode: "create",
    name: "",
    addressLine: "",
    description: "",
  };
}

function editFacilityDialog(facility: Facility): FacilityDialogState {
  return {
    mode: "edit",
    id: facility.id,
    name: facility.name,
    addressLine: facility.addressLine ?? "",
    description: facility.description ?? "",
  };
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient();

  const facilities = useQuery({ queryKey: ["admin-facilities"], queryFn: api.getAdminFacilities });
  const badgeApps = useQuery({ queryKey: ["admin-badge-apps"], queryFn: api.getBadgeApps });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const [notice, setNotice] = useState<NoticeState>(null);
  const [facilityDialog, setFacilityDialog] = useState<FacilityDialogState | null>(null);
  const [facilityToDeactivate, setFacilityToDeactivate] = useState<Facility | null>(null);
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(null);
  const [limit, setLimit] = useState("");

  useEffect(() => {
    if (settings.data?.regionLimit && !limit) {
      setLimit(settings.data.regionLimit);
    }
  }, [settings.data?.regionLimit, limit]);

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const createFacMut = useMutation({
    mutationFn: api.createFacility,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-facilities"] });
      await queryClient.invalidateQueries({ queryKey: ["facilities"] });
      setFacilityDialog(null);
      setNotice({ tone: "success", message: "Facility added." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not add the facility.",
      });
    },
  });

  const updateFacMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { name?: string; addressLine?: string; description?: string; isActive?: boolean };
    }) => api.updateFacility(id, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-facilities"] });
      await queryClient.invalidateQueries({ queryKey: ["facilities"] });
      setFacilityDialog(null);

      if (variables.payload.isActive === true) {
        setNotice({ tone: "success", message: "Facility reactivated." });
      } else {
        setNotice({ tone: "success", message: "Facility updated." });
      }
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not update the facility.",
      });
    },
  });

  const deactivateFacMut = useMutation({
    mutationFn: api.deactivateFacility,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-facilities"] });
      await queryClient.invalidateQueries({ queryKey: ["facilities"] });
      setFacilityToDeactivate(null);
      setNotice({ tone: "success", message: "Facility deactivated for future events." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not deactivate the facility.",
      });
    },
  });

  const updateSettingsMut = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setLimit(data.regionLimit);
      setNotice({ tone: "success", message: "Outdoor run location settings saved." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not update settings.",
      });
    },
  });

  const reviewMut = useMutation({
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

  const sortedApplications = (badgeApps.data?.applications ?? []).slice().sort((a, b) => {
    if (a.status === "submitted" && b.status !== "submitted") return -1;
    if (a.status !== "submitted" && b.status === "submitted") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  function saveFacility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!facilityDialog) return;

    const payload = {
      name: facilityDialog.name.trim(),
      addressLine: facilityDialog.addressLine.trim(),
      description: facilityDialog.description.trim(),
    };

    if (!payload.name) {
      setNotice({ tone: "error", message: "Facility name is required." });
      return;
    }

    if (facilityDialog.mode === "create") {
      createFacMut.mutate(payload);
    } else {
      updateFacMut.mutate({
        id: facilityDialog.id,
        payload,
      });
    }
  }

  function confirmReview() {
    if (!reviewDialog) return;

    reviewMut.mutate({
      id: reviewDialog.application.id,
      status: reviewDialog.status,
      decisionNotes: reviewDialog.decisionNotes.trim() || undefined,
    });
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <h2 className="text-2xl font-semibold">Admin Command Center</h2>
        <p className="mt-2 text-sm text-slate-400">
          Manage location settings, campus facilities, and trust badge applications.
        </p>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

      {facilities.error instanceof ApiError ? (
        <InlineNotice tone="error">{facilities.error.message}</InlineNotice>
      ) : null}

      {badgeApps.error instanceof ApiError ? (
        <InlineNotice tone="error">{badgeApps.error.message}</InlineNotice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <MapPin size={20} />
              Location Settings
            </h3>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="mb-1 text-sm font-bold text-slate-900">
                Geographic limit for outdoor runs
              </p>
              <p className="mb-3 text-xs leading-5 text-slate-500">
                This boundary is used when students search for outdoor running locations.
              </p>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium outline-none focus:border-slate-900"
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="New York State, US"
                  type="text"
                  value={limit}
                />
                <button
                  className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition disabled:opacity-50"
                  disabled={!limit.trim() || updateSettingsMut.isPending}
                  onClick={() => updateSettingsMut.mutate(limit.trim())}
                  type="button"
                >
                  {updateSettingsMut.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h4 className="text-md font-bold text-slate-900">Athletic facilities</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Students can select active facilities when creating facility-based events.
                </p>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                onClick={() => setFacilityDialog(emptyFacilityDialog())}
                type="button"
              >
                <Plus size={16} />
                Add facility
              </button>
            </div>

            <div className="space-y-3">
              {facilities.data?.facilities.map((facility) => (
                <article
                  className={`rounded-2xl border p-4 transition ${
                    facility.isActive
                      ? "border-slate-200 bg-white"
                      : "border-dashed border-slate-300 bg-slate-50"
                  }`}
                  key={facility.id}
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{facility.name}</p>
                        {facility.isActive ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {facility.addressLine || "No address provided"}
                      </p>
                      {facility.description ? (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                          {facility.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => setFacilityDialog(editFacilityDialog(facility))}
                        type="button"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      {facility.isActive ? (
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
                          onClick={() => setFacilityToDeactivate(facility)}
                          type="button"
                        >
                          <Trash2 size={14} />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                          onClick={() =>
                            updateFacMut.mutate({
                              id: facility.id,
                              payload: { isActive: true },
                            })
                          }
                          type="button"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {facilities.data?.facilities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm text-slate-500">No facilities have been added yet.</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldAlert size={20} />
            Badge application queue
          </h3>

          <div className="max-h-[650px] space-y-4 overflow-y-auto pr-2">
            {sortedApplications.map((application) => (
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
                      disabled={reviewMut.isPending}
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
                      disabled={reviewMut.isPending}
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
        </section>
      </div>

      {facilityDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <form
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            onSubmit={saveFacility}
          >
            <h2 className="text-lg font-bold text-slate-900">
              {facilityDialog.mode === "create" ? "Add facility" : "Edit facility"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Facilities marked active are available when students create facility-based events.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Facility name
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  maxLength={120}
                  onChange={(event) =>
                    setFacilityDialog((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  type="text"
                  value={facilityDialog.name}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Address</label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  maxLength={255}
                  onChange={(event) =>
                    setFacilityDialog((current) =>
                      current ? { ...current, addressLine: event.target.value } : current,
                    )
                  }
                  type="text"
                  value={facilityDialog.addressLine}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  className="min-h-28 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  maxLength={1000}
                  onChange={(event) =>
                    setFacilityDialog((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                  value={facilityDialog.description}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setFacilityDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={createFacMut.isPending || updateFacMut.isPending}
                type="submit"
              >
                {createFacMut.isPending || updateFacMut.isPending ? "Saving..." : "Save facility"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmActionDialog
        cancelLabel="Keep active"
        confirmLabel="Deactivate facility"
        description={
          facilityToDeactivate
            ? `${facilityToDeactivate.name} will no longer be available for new events. Existing events that already use this facility will remain unchanged.`
            : ""
        }
        loading={deactivateFacMut.isPending}
        onCancel={() => setFacilityToDeactivate(null)}
        onConfirm={() => {
          if (facilityToDeactivate) {
            deactivateFacMut.mutate(facilityToDeactivate.id);
          }
        }}
        open={facilityToDeactivate !== null}
        title="Deactivate this facility?"
        tone="danger"
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
                disabled={reviewMut.isPending}
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
                disabled={reviewMut.isPending}
                onClick={confirmReview}
                type="button"
              >
                {reviewMut.isPending
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
