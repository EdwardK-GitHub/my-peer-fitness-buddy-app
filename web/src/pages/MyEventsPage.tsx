import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckCircle2,
  Heart,
  LogOut,
  MapPin,
  Trophy,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import { BadgePills } from "../components/BadgePills";
import { ConfirmActionDialog } from "../components/ConfirmActionDialog";
import { InlineNotice } from "../components/InlineNotice";
import { PaginationControls } from "../components/PaginationControls";
import { ApiError, api, type EventRecord } from "../lib/api";
import { formatEventDateTime } from "../lib/datetime";
import { clampPage, getPageCount, paginate } from "../lib/pagination";

const EVENT_SECTION_PAGE_SIZE = 4;

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

type EventGroupProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  totalCount: number;
  page: number;
  totalPages: number;
  emptyTitle: string;
  emptyDescription: string;
  accentClass: string;
  children: ReactNode;
  onPageChange: (page: number) => void;
};

function splitByRole(events: EventRecord[] | undefined) {
  const safeEvents = events ?? [];

  return {
    hosted: safeEvents.filter((event) => event.isHost),
    attending: safeEvents.filter((event) => !event.isHost),
  };
}

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

function EventGroup({
  icon,
  title,
  subtitle,
  totalCount,
  page,
  totalPages,
  emptyTitle,
  emptyDescription,
  accentClass,
  children,
  onPageChange,
}: EventGroupProps) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accentClass}`}>
            {icon}
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-950">{title}</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          {totalCount}
        </span>
      </div>

      {totalCount > 0 ? (
        <>
          <div className="space-y-4">{children}</div>
          <PaginationControls
            currentPage={page}
            itemLabel="events"
            onPageChange={onPageChange}
            pageSize={EVENT_SECTION_PAGE_SIZE}
            totalItems={totalCount}
            totalPages={totalPages}
          />
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
          <p className="font-black text-slate-900">{emptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}

export function MyEventsPage() {
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState<NoticeState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [upcomingHostedPage, setUpcomingHostedPage] = useState(0);
  const [upcomingAttendingPage, setUpcomingAttendingPage] = useState(0);
  const [pastHostedPage, setPastHostedPage] = useState(0);
  const [pastAttendingPage, setPastAttendingPage] = useState(0);

  const myEvents = useQuery({ queryKey: ["my-events"], queryFn: api.getMyEvents });

  const upcomingGroups = useMemo(() => splitByRole(myEvents.data?.upcoming), [myEvents.data]);
  const pastGroups = useMemo(() => splitByRole(myEvents.data?.past), [myEvents.data]);

  const upcomingHostedPages = getPageCount(upcomingGroups.hosted.length, EVENT_SECTION_PAGE_SIZE);
  const upcomingAttendingPages = getPageCount(
    upcomingGroups.attending.length,
    EVENT_SECTION_PAGE_SIZE,
  );
  const pastHostedPages = getPageCount(pastGroups.hosted.length, EVENT_SECTION_PAGE_SIZE);
  const pastAttendingPages = getPageCount(pastGroups.attending.length, EVENT_SECTION_PAGE_SIZE);

  useEffect(() => {
    setUpcomingHostedPage((page) =>
      clampPage(page, upcomingGroups.hosted.length, EVENT_SECTION_PAGE_SIZE),
    );
    setUpcomingAttendingPage((page) =>
      clampPage(page, upcomingGroups.attending.length, EVENT_SECTION_PAGE_SIZE),
    );
    setPastHostedPage((page) => clampPage(page, pastGroups.hosted.length, EVENT_SECTION_PAGE_SIZE));
    setPastAttendingPage((page) =>
      clampPage(page, pastGroups.attending.length, EVENT_SECTION_PAGE_SIZE),
    );
  }, [
    upcomingGroups.hosted.length,
    upcomingGroups.attending.length,
    pastGroups.hosted.length,
    pastGroups.attending.length,
  ]);

  const upcomingHostedItems = paginate(
    upcomingGroups.hosted,
    upcomingHostedPage,
    EVENT_SECTION_PAGE_SIZE,
  );
  const upcomingAttendingItems = paginate(
    upcomingGroups.attending,
    upcomingAttendingPage,
    EVENT_SECTION_PAGE_SIZE,
  );
  const pastHostedItems = paginate(pastGroups.hosted, pastHostedPage, EVENT_SECTION_PAGE_SIZE);
  const pastAttendingItems = paginate(
    pastGroups.attending,
    pastAttendingPage,
    EVENT_SECTION_PAGE_SIZE,
  );

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
        className={`rounded-3xl border p-5 shadow-sm transition ${
          event.status === "canceled"
            ? "border-rose-200 bg-rose-50"
            : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
        }`}
        key={event.id}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-bold text-slate-900">{event.activityType}</h4>
              {roleBadge(event)}
              {statusBadge(event)}
              <BadgePills badges={event.host.badges} />
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
          View hosted and joined events separately, manage upcoming participation, and review past
          workout activity.
        </p>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}
      {myEvents.error instanceof ApiError ? (
        <InlineNotice tone="error">{myEvents.error.message}</InlineNotice>
      ) : null}

      <section className="rounded-[2rem] border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <CalendarCheck className="text-blue-600" size={22} />
          <div>
            <h3 className="text-xl font-black text-slate-900">Upcoming events</h3>
            <p className="text-sm text-slate-600">
              Manage events you host separately from events you joined as an attendee.
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <EventGroup
            accentClass="bg-blue-100 text-blue-700"
            emptyDescription="Events you create will appear here with attendee lists and host controls."
            emptyTitle="No upcoming hosted events"
            icon={<Trophy size={20} />}
            onPageChange={setUpcomingHostedPage}
            page={upcomingHostedPage}
            subtitle="Events you created and can manage as the host."
            title="Hosting"
            totalCount={upcomingGroups.hosted.length}
            totalPages={upcomingHostedPages}
          >
            {upcomingHostedItems.map(renderUpcomingEvent)}
          </EventGroup>

          <EventGroup
            accentClass="bg-emerald-100 text-emerald-700"
            emptyDescription="Events you join from the Events page will appear here."
            emptyTitle="No upcoming attended events"
            icon={<UserCheck size={20} />}
            onPageChange={setUpcomingAttendingPage}
            page={upcomingAttendingPage}
            subtitle="Events you joined and can withdraw from when allowed."
            title="Attending"
            totalCount={upcomingGroups.attending.length}
            totalPages={upcomingAttendingPages}
          >
            {upcomingAttendingItems.map(renderUpcomingEvent)}
          </EventGroup>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <CheckCircle2 className="text-slate-600" size={22} />
          <div>
            <h3 className="text-xl font-black text-slate-900">Past events</h3>
            <p className="text-sm text-slate-600">
              Review completed hosted events and past events you attended.
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <EventGroup
            accentClass="bg-slate-100 text-slate-700"
            emptyDescription="Past events you hosted will appear here after their scheduled time."
            emptyTitle="No past hosted events"
            icon={<Trophy size={20} />}
            onPageChange={setPastHostedPage}
            page={pastHostedPage}
            subtitle="Completed events where you were the host."
            title="Hosted"
            totalCount={pastGroups.hosted.length}
            totalPages={pastHostedPages}
          >
            {pastHostedItems.map(renderPastEvent)}
          </EventGroup>

          <EventGroup
            accentClass="bg-pink-100 text-pink-700"
            emptyDescription="Past events you attended will appear here, including like status."
            emptyTitle="No past attended events"
            icon={<Heart size={20} />}
            onPageChange={setPastAttendingPage}
            page={pastAttendingPage}
            subtitle="Completed events where you joined as an attendee."
            title="Attended"
            totalCount={pastGroups.attending.length}
            totalPages={pastAttendingPages}
          >
            {pastAttendingItems.map(renderPastEvent)}
          </EventGroup>
        </div>
      </section>

      <ConfirmActionDialog
        cancelLabel={pendingAction?.kind === "cancel" ? "Keep event" : "Stay joined"}
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
