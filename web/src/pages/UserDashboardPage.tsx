import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function UserDashboardPage() {
  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
          Student dashboard
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          Welcome back, {session.data?.user?.fullName}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Use your dashboard to find upcoming workouts, manage your events, and review trust badge
          options.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-md" to="/events">
          <h3 className="text-lg font-bold text-slate-900">Browse events</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Search upcoming gym sessions and runs by time, activity, or location.
          </p>
        </Link>

        <Link className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-md" to="/my-events">
          <h3 className="text-lg font-bold text-slate-900">My events</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            View events you host or attend, cancel hosted events, or withdraw as an attendee.
          </p>
        </Link>

        <Link className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-md" to="/badges">
          <h3 className="text-lg font-bold text-slate-900">Trust badges</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Apply for badges that can add credibility to events you post.
          </p>
        </Link>
      </div>
    </section>
  );
}
