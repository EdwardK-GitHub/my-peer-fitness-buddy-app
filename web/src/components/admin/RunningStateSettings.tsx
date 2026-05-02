import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinned } from "lucide-react";

import { ApiError, api } from "../../lib/api";
import { InlineNotice } from "../InlineNotice";
import { StateMultiSelect } from "./StateMultiSelect";

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

export function RunningStateSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);

  useEffect(() => {
    if (settings.data?.allowedStates) {
      setSelectedStates(settings.data.allowedStates);
    }
  }, [settings.data?.allowedStates]);

  const mutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSelectedStates(data.allowedStates);
      setNotice({ tone: "success", message: "Outdoor run state restrictions saved." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not update state restrictions.",
      });
    },
  });

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <MapPinned size={20} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">Outdoor run state restrictions</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Choose the U.S. states where students are allowed to select outdoor-run locations.
          </p>
        </div>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

      {settings.error instanceof ApiError ? (
        <div className="mt-4">
          <InlineNotice tone="error">{settings.error.message}</InlineNotice>
        </div>
      ) : null}

      <div className="mt-5">
        <StateMultiSelect
          onChange={setSelectedStates}
          options={settings.data?.stateOptions ?? []}
          value={selectedStates}
        />
      </div>

      <button
        className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={selectedStates.length === 0 || mutation.isPending}
        onClick={() => mutation.mutate(selectedStates)}
        type="button"
      >
        {mutation.isPending ? "Saving..." : "Save allowed states"}
      </button>
    </section>
  );
}
