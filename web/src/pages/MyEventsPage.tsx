import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function MyEventsPage() {
  const myEvents = useQuery({ queryKey: ["my-events"], queryFn: api.getMyEvents });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">My events</h2>
        <p className="mt-2 text-sm text-slate-600">
          The read-only dashboard is connected now. Withdraw, cancel, and like actions are prepared for the next build step.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Upcoming</h3>
          <div className="mt-4 space-y-3">
            {myEvents.data?.upcoming.length ? (
              myEvents.data.upcoming.map((event) => (
                <article className="rounded-2xl border border-slate-200 p-4" key={event.id}>
                  <p className="font-medium text-slate-900">{event.activityType}</p>
                  <p className="mt-1 text-sm text-slate-600">{new Date(event.scheduledAt).toLocaleString()}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600">No upcoming events for this account yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Past</h3>
          <div className="mt-4 space-y-3">
            {myEvents.data?.past.length ? (
              myEvents.data.past.map((event) => (
                <article className="rounded-2xl border border-slate-200 p-4" key={event.id}>
                  <p className="font-medium text-slate-900">{event.activityType}</p>
                  <p className="mt-1 text-sm text-slate-600">{new Date(event.scheduledAt).toLocaleString()}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600">No past events for this account yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}