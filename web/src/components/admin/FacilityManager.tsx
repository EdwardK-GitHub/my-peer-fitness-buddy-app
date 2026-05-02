import { type FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import { ApiError, api, type Facility } from "../../lib/api";
import { ConfirmActionDialog } from "../ConfirmActionDialog";
import { InlineNotice } from "../InlineNotice";

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

export function FacilityManager() {
  const queryClient = useQueryClient();
  const facilities = useQuery({ queryKey: ["admin-facilities"], queryFn: api.getAdminFacilities });

  const [notice, setNotice] = useState<NoticeState>(null);
  const [facilityDialog, setFacilityDialog] = useState<FacilityDialogState | null>(null);
  const [facilityToDeactivate, setFacilityToDeactivate] = useState<Facility | null>(null);

  const createMutation = useMutation({
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

  const updateMutation = useMutation({
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

      setNotice({
        tone: "success",
        message: variables.payload.isActive === true ? "Facility reactivated." : "Facility updated.",
      });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not update the facility.",
      });
    },
  });

  const deactivateMutation = useMutation({
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
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: facilityDialog.id, payload });
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MapPin size={20} />
            Athletic facilities
          </h3>
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

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

      {facilities.error instanceof ApiError ? (
        <div className="mt-4">
          <InlineNotice tone="error">{facilities.error.message}</InlineNotice>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
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
                      updateMutation.mutate({
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
                disabled={createMutation.isPending || updateMutation.isPending}
                type="submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : "Save facility"}
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
        loading={deactivateMutation.isPending}
        onCancel={() => setFacilityToDeactivate(null)}
        onConfirm={() => {
          if (facilityToDeactivate) {
            deactivateMutation.mutate(facilityToDeactivate.id);
          }
        }}
        open={facilityToDeactivate !== null}
        title="Deactivate this facility?"
        tone="danger"
      />
    </section>
  );
}
