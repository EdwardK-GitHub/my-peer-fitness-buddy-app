import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin, Search, UserPlus, X } from "lucide-react";

import { BadgePills } from "../components/BadgePills";
import { InlineNotice } from "../components/InlineNotice";
import { LocationSelector } from "../components/LocationSelector";
import { PaginationControls } from "../components/PaginationControls";
import { ApiError, api, type CreateEventInput, type EventRecord } from "../lib/api";
import {
  datetimeLocalToUtcIso,
  formatEventDateTime,
  isLocalDateTimeInPast,
  nowDateTimeLocalInput,
} from "../lib/datetime";

const PAGE_SIZE = 10;

type CreateEventForm = {
  activityType: string;
  scheduledAt: string;
  capacity: string;
  locationType: "facility" | "running";
  facilityId: string;
  locationLabel: string;
  locationDetails: string;
  notes: string;
};

type NoticeState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const initialForm: CreateEventForm = {
  activityType: "",
  scheduledAt: "",
  capacity: "2",
  locationType: "facility",
  facilityId: "",
  locationLabel: "",
  locationDetails: "",
  notes: "",
};

function getEventAvailabilityText(event: EventRecord): string {
  if (event.isHost) {
    return "You are hosting";
  }
  if (event.joined) {
    return "You joined";
  }
  if (event.status !== "active") {
    return "Canceled";
  }
  if (event.isPast) {
    return "Past event";
  }
  if (event.spotsRemaining <= 0) {
    return "Full";
  }
  return `${event.spotsRemaining} spot${event.spotsRemaining === 1 ? "" : "s"} left`;
}

function eventStatusClasses(event: EventRecord): string {
  if (event.isHost) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (event.joined) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (event.spotsRemaining <= 0) {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }
  return "bg-white text-slate-700 border-slate-200";
}

export function EventsPage() {
  const queryClient = useQueryClient();

  // FReq 2.1: Users can specify a time range when searching for events.
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // FReq 2.2: Browsing can also be narrowed by keyword and location type for smoother use.
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationTypeFilter, setLocationTypeFilter] = useState("");
  const [page, setPage] = useState(0);

  const [notice, setNotice] = useState<NoticeState>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateEventForm>(initialForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);

  const minimumDateTime = useMemo(() => nowDateTimeLocalInput(), []);

  useEffect(() => {
    const timerId = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timerId);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [filterFrom, filterTo, debouncedSearch, locationTypeFilter]);

  const timeFilterError =
    filterFrom && filterTo && new Date(filterFrom).getTime() > new Date(filterTo).getTime()
      ? "Start time must be before end time."
      : "";

  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: api.getFacilities });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const events = useQuery({
    queryKey: ["events", filterFrom, filterTo, debouncedSearch, locationTypeFilter, page],
    enabled: !timeFilterError,
    queryFn: () =>
      api.getEvents({
        from: filterFrom ? datetimeLocalToUtcIso(filterFrom) : undefined,
        to: filterTo ? datetimeLocalToUtcIso(filterTo) : undefined,
        q: debouncedSearch || undefined,
        locationType: locationTypeFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  });

  const activeFacilities = facilities.data?.facilities ?? [];
  const eventList = events.data?.events ?? [];
  const total = events.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);
  const hasActiveFilters = Boolean(filterFrom || filterTo || searchInput || locationTypeFilter);

  const createEventMutation = useMutation({
    mutationFn: api.createEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      setForm(initialForm);
      setFormErrors({});
      setShowCreate(false);
      setNotice({ tone: "success", message: "Your event has been posted." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not create the event.",
      });
    },
  });

  const joinEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      setJoiningEventId(eventId);
      await api.joinEvent(eventId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      setNotice({ tone: "success", message: "You joined the event." });
    },
    onError: (error) => {
      setNotice({
        tone: "error",
        message: error instanceof ApiError ? error.message : "Could not join the event.",
      });
    },
    onSettled: () => setJoiningEventId(null),
  });

  function clearAllFilters() {
    setFilterFrom("");
    setFilterTo("");
    setSearchInput("");
    setLocationTypeFilter("");
  }

  function updateForm<K extends keyof CreateEventForm>(key: K, value: CreateEventForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validateCreateForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    const capacity = Number(form.capacity);

    if (!form.activityType.trim()) {
      errors.activityType = "Enter the activity type.";
    }

    if (!form.scheduledAt) {
      errors.scheduledAt = "Choose a date and time.";
    } else if (isLocalDateTimeInPast(form.scheduledAt)) {
      errors.scheduledAt = "Choose a future date and time.";
    }

    if (!Number.isInteger(capacity)) {
      errors.capacity = "Capacity must be a whole number.";
    } else if (capacity < 2) {
      errors.capacity = "Capacity must be at least 2 because the host counts as one participant.";
    } else if (capacity > 50) {
      errors.capacity = "Capacity cannot be greater than 50.";
    }

    if (form.locationType === "facility" && !form.facilityId) {
      errors.facilityId = "Choose an approved facility.";
    }

    if (form.locationType === "running" && (!form.locationLabel || !form.locationDetails)) {
      errors.locationLabel = "Search and select a suggested running location.";
    }

    if (form.notes.length > 1000) {
      errors.notes = "Notes must be 1000 characters or fewer.";
    }

    return errors;
  }

  function submitCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateCreateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      setNotice({ tone: "error", message: "Please fix the highlighted fields before posting." });
      return;
    }

    const payload: CreateEventInput = {
      activityType: form.activityType.trim(),
      scheduledAt: datetimeLocalToUtcIso(form.scheduledAt),
      capacity: Number(form.capacity),
      locationType: form.locationType,
      notes: form.notes.trim() || undefined,
    };

    if (form.locationType === "facility") {
      payload.facilityId = form.facilityId;
    } else {
      payload.locationLabel = form.locationLabel;
      payload.locationDetails = form.locationDetails;
    }

    createEventMutation.mutate(payload);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              Find a workout partner
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">Browse campus fitness events</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Search upcoming gym sessions and outdoor runs, then join events that match your
              schedule and comfort level.
            </p>
          </div>

          {session.data?.authenticated ? (
            <button
              className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                showCreate
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
              }`}
              onClick={() => setShowCreate((current) => !current)}
              type="button"
            >
              {showCreate ? (
                <span className="flex items-center gap-2">
                  <X size={18} /> Close form
                </span>
              ) : (
                "+ Post Event"
              )}
            </button>
          ) : null}
        </div>
      </div>

      {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}
      {timeFilterError ? <InlineNotice tone="error">{timeFilterError}</InlineNotice> : null}
      {events.error instanceof ApiError ? (
        <InlineNotice tone="error">{events.error.message}</InlineNotice>
      ) : null}

      {showCreate ? (
        <form
          className="rounded-3xl border border-blue-100 bg-white p-8 shadow-sm"
          onSubmit={submitCreateEvent}
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900">Post a workout event</h3>
            <p className="mt-2 text-sm text-slate-600">
              Hosts count as participants, so the capacity should include you and everyone who joins.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Activity type
              </label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                maxLength={80}
                onChange={(event) => updateForm("activityType", event.target.value)}
                placeholder="e.g. Upper Body Gym Session"
                type="text"
                value={form.activityType}
              />
              {formErrors.activityType ? (
                <p className="mt-2 text-sm text-rose-600">{formErrors.activityType}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Date and time
              </label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                min={minimumDateTime}
                onChange={(event) => updateForm("scheduledAt", event.target.value)}
                type="datetime-local"
                value={form.scheduledAt}
              />
              {formErrors.scheduledAt ? (
                <p className="mt-2 text-sm text-rose-600">{formErrors.scheduledAt}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Capacity
              </label>
              <input
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                max={50}
                min={2}
                onChange={(event) => updateForm("capacity", event.target.value)}
                type="number"
                value={form.capacity}
              />
              {formErrors.capacity ? (
                <p className="mt-2 text-sm text-rose-600">{formErrors.capacity}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Location type
              </label>
              <select
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    locationType: event.target.value as "facility" | "running",
                    facilityId: "",
                    locationLabel: "",
                    locationDetails: "",
                  }))
                }
                value={form.locationType}
              >
                <option value="facility">College facility</option>
                <option value="running">Outdoor run</option>
              </select>
            </div>
          </div>

          <div className="mt-5">
            {form.locationType === "facility" ? (
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Approved facility
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"
                  onChange={(event) => updateForm("facilityId", event.target.value)}
                  value={form.facilityId}
                >
                  <option value="">Choose a facility...</option>
                  {activeFacilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
                {formErrors.facilityId ? (
                  <p className="mt-2 text-sm text-rose-600">{formErrors.facilityId}</p>
                ) : null}
                {activeFacilities.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    No active facilities are currently available.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <label className="mb-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Running location
                </label>
                <LocationSelector
                  allowedStates={settings.data?.allowedStates ?? []}
                  onClear={() =>
                    setForm((current) => ({
                      ...current,
                      locationLabel: "",
                      locationDetails: "",
                    }))
                  }
                  onSelect={(label, lat, lng, stateCode, stateName) =>
                    setForm((current) => ({
                      ...current,
                      locationLabel: label,
                      locationDetails: JSON.stringify({ lat, lng, stateCode, stateName }),
                    }))
                  }
                  stateOptions={settings.data?.stateOptions ?? []}
                />
                {form.locationLabel ? (
                  <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700">
                    Selected: {form.locationLabel}
                  </p>
                ) : null}
                {formErrors.locationLabel ? (
                  <p className="mt-2 text-sm text-rose-600">{formErrors.locationLabel}</p>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Notes
            </label>
            <textarea
              className="min-h-28 w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              maxLength={1000}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Optional details such as pace, experience level, or what to bring."
              value={form.notes}
            />
            {formErrors.notes ? (
              <p className="mt-2 text-sm text-rose-600">{formErrors.notes}</p>
            ) : null}
          </div>

          <button
            className="mt-6 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
            disabled={createEventMutation.isPending}
            type="submit"
          >
            {createEventMutation.isPending ? "Posting event..." : "Post event"}
          </button>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none focus:border-blue-600"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by activity, location, note, or host..."
                type="text"
                value={searchInput}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  From
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-600"
                  onChange={(event) => setFilterFrom(event.target.value)}
                  type="datetime-local"
                  value={filterFrom}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  To
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-600"
                  onChange={(event) => setFilterTo(event.target.value)}
                  type="datetime-local"
                  value={filterTo}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Type
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-600"
                  onChange={(event) => setLocationTypeFilter(event.target.value)}
                  value={locationTypeFilter}
                >
                  <option value="">All events</option>
                  <option value="facility">Facility</option>
                  <option value="running">Outdoor run</option>
                </select>
              </div>
              {hasActiveFilters ? (
                <button
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={clearAllFilters}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Clock size={14} />
              {total === 0
                ? "No upcoming events found"
                : `Showing ${rangeStart}-${rangeEnd} of ${total} upcoming event${
                    total === 1 ? "" : "s"
                  }`}
              {events.isFetching ? <span>Refreshing...</span> : null}
            </div>
          </div>

          <div className="space-y-4">
            {eventList.map((event) => (
              <article
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                key={event.id}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{event.activityType}</h3>
                      <BadgePills badges={event.host.badges} />
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-600">
                      {formatEventDateTime(event.scheduledAt)}
                    </p>
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <MapPin className="text-blue-500" size={16} />
                      {event.locationLabel}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Hosted by {event.host.fullName}</p>
                    {event.notes ? (
                      <p className="mt-3 max-w-2xl rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                        {event.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4 md:min-w-52">
                    <p className="text-sm font-bold text-slate-900">
                      {event.participantCount} / {event.capacity} participants
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Host included in the capacity count
                    </p>

                    <div
                      className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${eventStatusClasses(
                        event,
                      )}`}
                    >
                      {getEventAvailabilityText(event)}
                    </div>

                    <div className="mt-4">
                      {!session.data?.authenticated ? (
                        <span className="text-sm font-medium text-slate-500">
                          Sign in to join
                        </span>
                      ) : event.canJoin ? (
                        <button
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                          disabled={joinEventMutation.isPending && joiningEventId === event.id}
                          onClick={() => joinEventMutation.mutate(event.id)}
                          type="button"
                        >
                          <UserPlus size={18} />
                          {joinEventMutation.isPending && joiningEventId === event.id
                            ? "Joining..."
                            : "Join event"}
                        </button>
                      ) : (
                        <button
                          className="w-full cursor-not-allowed rounded-2xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-500"
                          disabled
                          type="button"
                        >
                          Join unavailable
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {eventList.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 className="text-lg font-bold text-slate-900">No matching events</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Try adjusting your search filters or post a new event for others to join.
                </p>
              </div>
            ) : null}

            <PaginationControls
              currentPage={page}
              itemLabel="upcoming events"
              onPageChange={setPage}
              pageSize={PAGE_SIZE}
              totalItems={total}
              totalPages={totalPages}
            />
          </div>
        </div>

        <aside className="h-fit rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
          <h3 className="text-lg font-bold">Campus facilities</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Facility events use locations approved by campus staff.
          </p>

          <div className="mt-5 space-y-4">
            {activeFacilities.map((facility) => (
              <article className="border-b border-slate-700 pb-4 last:border-0" key={facility.id}>
                <p className="font-bold">{facility.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{facility.addressLine}</p>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
