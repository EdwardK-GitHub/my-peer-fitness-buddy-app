import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Heart, LogOut, MapPin, Users, XCircle } from "lucide-react";

import { ConfirmActionDialog } from "../components/ConfirmActionDialog";
import { InlineNotice } from "../components/InlineNotice";
import { ApiError, api, type EventRecord } from "../lib/api";
import { formatEventDateTime } from "../lib/datetime";

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type PendingAction =
  | {
      kind: "cancel";
      eventId: string;
      eventName: string;
    }
  | {
      kind: "withdraw";
      eventId: string;
      eventName: string;
    };

function roleBadge(event: EventRecord) {
  if (event.isHost) {
    return (
      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
        Host
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
      Attendee
    </span>
  );
}

function statusBadge(event: EventRecord) {
  if (event.status === "canceled") {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">
        Canceled
      </span>
    );
  }

  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">
      Active
    </span>
  );
}

export function MyEventsPage() {
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState<NoticeState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const myEvents = useQuery({ queryKey: ["my-events"], queryFn: api.getMyEvents });

  const cancelEventMutation = useMutation({
    mutationFn: api.cancelEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setNotice({ tone: "success", message: "Event canceled." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not cancel the event.",
      });
    },
  });

  const withdrawEventMutation = useMutation({
    mutationFn: api.withdrawEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      setNotice({ tone: "success", message: "You withdrew from the event." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not withdraw from the event.",
      });
    },
  });

  const likeEventMutation = useMutation({
    mutationFn: api.likeEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      setNotice({ tone: "success", message: "Thanks for liking the event." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not like the event.",
      });
    },
  });

  const actionLoading = cancelEventMutation.isPending || withdrawEventMutation.isPending;

  function confirmPendingAction() {
    if (!pendingAction) {
      return;
    }

    if (pendingAction.kind === "cancel") {
      cancelEventMutation.mutate(pendingAction.eventId);
    } else {
      withdrawEventMutation.mutate(pendingAction.eventId);
    }

    setPendingAction(null);
  }

  function renderUpcomingEvent(event: EventRecord) {
    return (
      <article
        className={`rounded-3xl border p-5 shadow-sm ${
          event.status === "canceled"
            ? "border-rose-200 bg-rose-50"
            : "border-slate-200 bg-white hover:border-blue-200"
        }`}
        key={event.id}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-bold text-slate-900">{event.activityType}</h4>
              {roleBadge(event)}
              {statusBadge(event)}
            </div>

            <p className="mt-2 text-sm font-medium text-slate-600">
              {formatEventDateTime(event.scheduledAt)}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MapPin size={15} className="text-blue-500" />
              {event.locationLabel}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {event.participantCount} / {event.capacity} participants
            </p>
            {event.notes ? (
              <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {event.notes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 md:min-w-44">
            {event.canCancel ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                onClick={() =>
                  setPendingAction({
                    kind: "cancel",
                    eventId: event.id,
                    eventName: event.activityType,
                  })
                }
                type="button"
              >
                <XCircle size={18} />
                Cancel event
              </button>
            ) : null}

            {event.canWithdraw ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                onClick={() =>
                  setPendingAction({
                    kind: "withdraw",
                    eventId: event.id,
                    eventName: event.activityType,
                  })
                }
                type="button"
              >
                <LogOut size={18} />
                Withdraw
              </button>
            ) : null}

            {!event.canCancel && !event.canWithdraw ? (
              <span className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-500">
                No action available
              </span>
            ) : null}
          </div>
        </div>

        {event.isHost ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Users size={16} />
              Signed-up attendees ({event.attendeeCount})
            </p>
            {event.attendees && event.attendees.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {event.attendees.map((attendee) => (
                  <li className="rounded-xl bg-white px-3 py-2 font-medium" key={attendee.id}>
                    {attendee.fullName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No attendees have joined yet.</p>
            )}
          </div>
        ) : null}
      </article>
    );
  }

  function renderPastEvent(event: EventRecord) {
    return (
      <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={event.id}>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-bold text-slate-900">{event.activityType}</h4>
          {roleBadge(event)}
          {statusBadge(event)}
        </div>

        <p className="mt-2 text-sm font-medium text-slate-600">
          {formatEventDateTime(event.scheduledAt)}
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <MapPin size={15} className="text-blue-500" />
          {event.locationLabel}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {event.participantCount} / {event.capacity} participants
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          {!event.isHost && event.status !== "canceled" ? (
            <button
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                event.liked
                  ? "border-pink-200 bg-pink-50 text-pink-600"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              disabled={event.liked || likeEventMutation.isPending}
              onClick={() => likeEventMutation.mutate(event.id)}
              type="button"
            >
              <Heart fill={event.liked ? "currentColor" : "none"} size={18} />
              {event.liked ? "Liked" : "Like event"}
            </button>
          ) : (
            <span className="text-sm font-medium text-slate-500">Event history</span>
          )}

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {event.likeCount} like{event.likeCount === 1 ? "" : "s"}
          </span>
        </div>
      </article>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
          Your schedule
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">My Events</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          View events you are hosting or attending, manage upcoming participation, and review your
          past fitness activity.
        </p>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}
      {myEvents.error instanceof ApiError ? (
        <InlineNotice tone="error">{myEvents.error.message}</InlineNotice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border-t-4 border-blue-500 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <CalendarCheck className="text-blue-600" size={22} />
            <h3 className="text-xl font-bold text-slate-900">Upcoming events</h3>
          </div>

          <div className="space-y-4">
            {myEvents.data?.upcoming.map(renderUpcomingEvent)}
            {myEvents.data?.upcoming.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center">
                <h4 className="font-bold text-slate-900">No upcoming events</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Join an event or post your own workout from the Events page.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border-t-4 border-slate-300 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <CheckCircle2 className="text-slate-600" size={22} />
            <h3 className="text-xl font-bold text-slate-900">Past events</h3>
          </div>

          <div className="space-y-4">
            {myEvents.data?.past.map(renderPastEvent)}
            {myEvents.data?.past.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center">
                <h4 className="font-bold text-slate-900">No past events yet</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Completed hosted and joined events will appear here.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <ConfirmActionDialog
        confirmLabel={pendingAction?.kind === "cancel" ? "Cancel event" : "Withdraw"}
        description={
          pendingAction?.kind === "cancel"
            ? `Cancel "${pendingAction.eventName}"? Students will no longer be able to join this event.`
            : `Withdraw from "${pendingAction?.eventName}"? Your spot will become available to another student.`
        }
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        open={pendingAction !== null}
        title={pendingAction?.kind === "cancel" ? "Cancel this event?" : "Withdraw from event?"}
        tone={pendingAction?.kind === "cancel" ? "danger" : "neutral"}
      />
    </section>
  );
}
