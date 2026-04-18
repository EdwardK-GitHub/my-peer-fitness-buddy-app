import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function EventsPage() {
  const events = useQuery({ queryKey: ["events"], queryFn: api.getEvents });
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: api.getFacilities });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Events</h2>
        <p className="mt-2 text-sm text-slate-600">
          Event browsing is wired to the API. Event creation and join flows are reserved for the next development step.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Upcoming results</h3>
          <div className="mt-4 space-y-4">
            {events.data?.events.length ? (
              events.data.events.map((event) => (
                <article className="rounded-2xl border border-slate-200 p-4" key={event.id}>
                  <p className="text-sm font-semibold text-slate-900">{event.activityType}</p>
                  <p className="mt-1 text-sm text-slate-600">{new Date(event.scheduledAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm text-slate-600">Host: {event.host.fullName}</p>
                  <p className="mt-1 text-sm text-slate-600">Location: {event.locationLabel ?? event.facility?.name ?? "TBD"}</p>
                  <p className="mt-1 text-sm text-slate-600">Attendance: {event.attendanceCount} / {event.capacity}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600">No events returned yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Active facilities</h3>
          <div className="mt-4 space-y-3">
            {facilities.data?.facilities.map((facility) => (
              <article className="rounded-2xl border border-slate-200 p-4" key={facility.id}>
                <p className="font-medium text-slate-900">{facility.name}</p>
                <p className="mt-1 text-sm text-slate-600">{facility.addressLine}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}