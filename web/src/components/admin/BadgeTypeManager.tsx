import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmActionDialog } from "../ConfirmActionDialog";
import { InlineNotice } from "../InlineNotice";
import { ApiError, api, type BadgeType } from "../../lib/api";

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type BadgeTypeDialogState =
  | {
      mode: "create";
      id?: never;
      code?: never;
      isDefault?: false;
      displayName: string;
      description: string;
    }
  | {
      mode: "edit";
      id: string;
      code: string;
      isDefault: boolean;
      displayName: string;
      description: string;
    };

function emptyBadgeTypeDialog(): BadgeTypeDialogState {
  return {
    mode: "create",
    displayName: "",
    description: "",
  };
}

function editBadgeTypeDialog(badgeType: BadgeType): BadgeTypeDialogState {
  return {
    mode: "edit",
    id: badgeType.id,
    code: badgeType.code,
    isDefault: badgeType.isDefault === true || badgeType.code === "peer_trainer",
    displayName: badgeType.displayName,
    description: badgeType.description ?? "",
  };
}

export function BadgeTypeManager() {
  const queryClient = useQueryClient();

  const badgeTypes = useQuery({
    queryKey: ["admin-badge-types"],
    queryFn: api.getAdminBadgeTypes,
  });

  const [notice, setNotice] = useState<NoticeState>(null);
  const [badgeDialog, setBadgeDialog] = useState<BadgeTypeDialogState | null>(null);
  const [badgeToDelete, setBadgeToDelete] = useState<BadgeType | null>(null);

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  async function refreshBadgeData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-badge-types"] }),
      queryClient.invalidateQueries({ queryKey: ["badge-types"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-badge-apps"] }),
      queryClient.invalidateQueries({ queryKey: ["my-badge-applications"] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["my-events"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: api.createBadgeType,
    onSuccess: async () => {
      await refreshBadgeData();
      setBadgeDialog(null);
      setNotice({ tone: "success", message: "Badge type created." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not create the badge type.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { displayName?: string; description?: string; isActive?: boolean };
    }) => api.updateBadgeType(id, payload),
    onSuccess: async (_data, variables) => {
      await refreshBadgeData();
      setBadgeDialog(null);

      if (variables.payload.isActive === true) {
        setNotice({ tone: "success", message: "Badge type restored." });
      } else {
        setNotice({ tone: "success", message: "Badge type updated." });
      }
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not update the badge type.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteBadgeType,
    onSuccess: async () => {
      await refreshBadgeData();
      setBadgeToDelete(null);
      setNotice({
        tone: "success",
        message: "Badge type deleted. It is hidden from applications and event cards.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not delete the badge type.",
      });
    },
  });

  function saveBadgeType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!badgeDialog) return;

    const displayName = badgeDialog.displayName.trim();
    const description = badgeDialog.description.trim();

    if (!displayName) {
      setNotice({ tone: "error", message: "Badge name is required." });
      return;
    }

    if (badgeDialog.mode === "create") {
      createMutation.mutate({ displayName, description });
      return;
    }

    updateMutation.mutate({
      id: badgeDialog.id,
      payload: badgeDialog.isDefault
        ? { description }
        : {
            displayName,
            description,
          },
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <BadgeCheck size={20} />
            Badge types
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Create and manage the trust badge options students can apply for. Deleted badge types
            are hidden from user applications and event cards.
          </p>
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
          onClick={() => setBadgeDialog(emptyBadgeTypeDialog())}
          type="button"
        >
          <Plus size={16} />
          Add badge type
        </button>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

      {badgeTypes.error instanceof ApiError ? (
        <div className="mt-4">
          <InlineNotice tone="error">{badgeTypes.error.message}</InlineNotice>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {badgeTypes.data?.badgeTypes.map((badgeType) => {
          const isDefault = badgeType.isDefault === true || badgeType.code === "peer_trainer";

          return (
            <article
              className={`rounded-2xl border p-4 transition ${
                badgeType.isActive
                  ? "border-slate-200 bg-white"
                  : "border-dashed border-slate-300 bg-slate-50"
              }`}
              key={badgeType.id}
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{badgeType.displayName}</p>

                    {isDefault ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                        Default
                      </span>
                    ) : null}

                    {badgeType.isActive ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                        Deleted
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs font-medium text-slate-400">{badgeType.code}</p>

                  {badgeType.description ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      {badgeType.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">No description provided.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setBadgeDialog(editBadgeTypeDialog(badgeType))}
                    type="button"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>

                  {badgeType.isActive && !isDefault ? (
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
                      onClick={() => setBadgeToDelete(badgeType)}
                      type="button"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  ) : null}

                  {!badgeType.isActive ? (
                    <button
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                      onClick={() =>
                        updateMutation.mutate({
                          id: badgeType.id,
                          payload: { isActive: true },
                        })
                      }
                      type="button"
                    >
                      Restore
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}

        {badgeTypes.data?.badgeTypes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">No badge types have been added yet.</p>
          </div>
        ) : null}
      </div>

      {badgeDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <form
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            onSubmit={saveBadgeType}
          >
            <h2 className="text-lg font-bold text-slate-900">
              {badgeDialog.mode === "create" ? "Add badge type" : "Edit badge type"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Active badge types are visible to students and can appear on event cards after admin
              approval.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Badge name
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={badgeDialog.mode === "edit" && badgeDialog.isDefault}
                  maxLength={120}
                  onChange={(event) =>
                    setBadgeDialog((current) =>
                      current ? { ...current, displayName: event.target.value } : current,
                    )
                  }
                  type="text"
                  value={badgeDialog.displayName}
                />
                {badgeDialog.mode === "edit" && badgeDialog.isDefault ? (
                  <p className="mt-2 text-xs text-slate-500">
                    The default Peer Trainer badge name is protected.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  className="min-h-28 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  maxLength={1000}
                  onChange={(event) =>
                    setBadgeDialog((current) =>
                      current ? { ...current, description: event.target.value } : current,
                    )
                  }
                  placeholder="Explain what this badge means and what students should include in their application."
                  value={badgeDialog.description}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setBadgeDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={createMutation.isPending || updateMutation.isPending}
                type="submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : "Save badge type"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmActionDialog
        cancelLabel="Keep badge type"
        confirmLabel="Delete badge type"
        description={
          badgeToDelete
            ? `${badgeToDelete.displayName} will be hidden from user applications and event cards. Pending applications for this badge will be closed.`
            : ""
        }
        loading={deleteMutation.isPending}
        onCancel={() => setBadgeToDelete(null)}
        onConfirm={() => {
          if (badgeToDelete) {
            deleteMutation.mutate(badgeToDelete.id);
          }
        }}
        open={badgeToDelete !== null}
        title="Delete this badge type?"
        tone="danger"
      />
    </section>
  );
}
