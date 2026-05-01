import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MapPin, Pencil, Plus, ShieldAlert, Trash2, XCircle } from "lucide-react";

import { InlineNotice } from "../components/InlineNotice";
import { ApiError, api } from "../lib/api";

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

function applicationStatusClasses(status: string): string {
  if (status === "approved") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  if (status === "denied") {
    return "bg-rose-100 text-rose-700 border-rose-200";
  }

  return "bg-blue-200 text-blue-800 border-blue-300";
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient();

  const facilities = useQuery({ queryKey: ["admin-facilities"], queryFn: api.getAdminFacilities });
  const badgeApps = useQuery({ queryKey: ["admin-badge-apps"], queryFn: api.getBadgeApps });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const [notice, setNotice] = useState<NoticeState>(null);

  // FReq 4: Admin-managed facility list state.
  const [facName, setFacName] = useState("");
  const [facAddress, setFacAddress] = useState("");

  const createFacMut = useMutation({
    mutationFn: api.createFacility,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-facilities"] });
      setFacName("");
      setFacAddress("");
      setNotice({ tone: "success", message: "Facility added." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not add the facility.",
      });
    },
  });

  const deactivateFacMut = useMutation({
    mutationFn: api.deactivateFacility,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-facilities"] });
      setNotice({ tone: "success", message: "Facility deactivated." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not deactivate the facility.",
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

  // FReq 4: Admin-managed running-region setting state.
  const [limit, setLimit] = useState("");

  const updateSettingsMut = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setNotice({ tone: "success", message: "Outdoor run location settings saved." });
      setLimit("");
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not update settings.",
      });
    },
  });

  // FReq 6.4: Admins manually approve or deny trust badge applications.
  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "denied" }) =>
      api.reviewBadgeApp(id, status),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-badge-apps"] });

      // FReq 6.5: Approved badges appear on posted events, so event caches must refresh.
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });

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
          error instanceof ApiError
            ? error.message
            : "Could not review the badge application.",
      });
    },
  });

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const sortedApplications = (badgeApps.data?.applications ?? []).slice().sort((a, b) => {
    if (a.status === "submitted" && b.status !== "submitted") return -1;
    if (a.status !== "submitted" && b.status === "submitted") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <h2 className="text-2xl font-semibold">Admin Command Center</h2>
        <p className="mt-2 text-sm text-slate-400">
          Oversee locations, settings, and student applications.
        </p>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

      {badgeApps.error instanceof ApiError ? (
        <InlineNotice tone="error">{badgeApps.error.message}</InlineNotice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* FReq 4: Facility and region management */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <MapPin size={20} />
              Location Settings
            </h3>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="mb-1 text-sm font-bold text-slate-900">
                Geographic Limit for Outdoor Runs
              </p>
              <p className="mb-3 text-xs text-slate-500">
                Restrict user map searches to this boundary, such as "New York State".
              </p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium outline-none focus:border-slate-900"
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder={settings.data?.regionLimit || "New York State, US"}
                  type="text"
                  value={limit}
                />
                <button
                  className="rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition disabled:opacity-50"
                  disabled={!limit.trim() || updateSettingsMut.isPending}
                  onClick={() => updateSettingsMut.mutate(limit.trim())}
                  type="button"
                >
                  Save
                </button>
              </div>
            </div>

            <hr className="my-6 border-slate-100" />

            <h4 className="mb-3 text-md font-bold text-slate-900">Athletic Facilities List</h4>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  className="rounded-xl border px-3 py-2 text-sm outline-none"
                  onChange={(event) => setFacName(event.target.value)}
                  placeholder="Facility Name"
                  type="text"
                  value={facName}
                />
                <input
                  className="rounded-xl border px-3 py-2 text-sm outline-none"
                  onChange={(event) => setFacAddress(event.target.value)}
                  placeholder="Address"
                  type="text"
                  value={facAddress}
                />
                <button
                  className="flex items-center gap-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  disabled={!facName.trim() || createFacMut.isPending}
                  onClick={() =>
                    createFacMut.mutate({
                      name: facName.trim(),
                      addressLine: facAddress.trim(),
                    })
                  }
                  type="button"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>

            <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
              {facilities.data?.facilities.map((facility) => (
                <div
                  className={`flex items-center justify-between rounded-2xl border p-4 transition ${
                    !facility.isActive
                      ? "border-dashed bg-slate-50 opacity-60"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  key={facility.id}
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{facility.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{facility.addressLine}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                      onClick={() => {
                        const nextName = window.prompt("Edit facility name", facility.name);
                        if (nextName === null) return;

                        const nextAddress = window.prompt(
                          "Edit facility address",
                          facility.addressLine ?? "",
                        );
                        if (nextAddress === null) return;

                        const currentDescription =
                          typeof facility.description === "string" ? facility.description : "";
                        const nextDescription = window.prompt(
                          "Edit facility description (can be empty)",
                          currentDescription,
                        );
                        if (nextDescription === null) return;

                        updateFacMut.mutate({
                          id: facility.id,
                          payload: {
                            name: nextName,
                            addressLine: nextAddress,
                            description: nextDescription,
                          },
                        });
                      }}
                      type="button"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    {facility.isActive ? (
                      <button
                        className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-500 transition hover:bg-rose-100"
                        onClick={() => {
                          if (window.confirm("Deactivate facility?")) {
                            deactivateFacMut.mutate(facility.id);
                          }
                        }}
                        type="button"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    ) : (
                      <>
                        <span className="rounded bg-slate-200 px-2 py-1 text-xs font-bold text-slate-400">
                          INACTIVE
                        </span>
                        <button
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
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
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FReq 6.3 and FReq 6.4: Badge review queue */}
        <div className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldAlert size={20} />
            Action Queue: Badges
          </h3>

          <div className="max-h-[600px] space-y-4 overflow-y-auto pr-2">
            {sortedApplications.map((application) => (
              <article
                className={`rounded-2xl border p-5 ${
                  application.status === "submitted"
                    ? "border-blue-200 bg-blue-50"
                    : "border-slate-200 bg-slate-50"
                }`}
                key={application.id}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <span className="block text-sm font-bold text-slate-900">
                      {application.applicantName ?? "Unknown applicant"}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {new Date(application.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <span
                    className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${applicationStatusClasses(
                      application.status,
                    )}`}
                  >
                    {application.status}
                  </span>
                </div>

                <p className="mb-1 border-t border-slate-200/50 pt-2 text-xs font-bold text-slate-700">
                  Requested: {application.badgeName}
                </p>

                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm italic leading-relaxed text-slate-700">
                  "{application.message}"
                </div>

                {application.status === "submitted" ? (
                  <div className="mt-4 flex gap-2">
                    <button
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                      disabled={reviewMut.isPending}
                      onClick={() =>
                        reviewMut.mutate({
                          id: application.id,
                          status: "approved",
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
                        reviewMut.mutate({
                          id: application.id,
                          status: "denied",
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
        </div>
      </div>
    </section>
  );
}
