import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function UserDashboardPage() {
  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Welcome back, {session.data?.user?.fullName}. This page is ready to grow into your full student home screen.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link className="rounded-3xl bg-white p-6 shadow-sm" to="/events">
          <h3 className="text-lg font-semibold text-slate-900">Browse events</h3>
          <p className="mt-2 text-sm text-slate-600">See upcoming workout sessions and runs.</p>
        </Link>

        <Link className="rounded-3xl bg-white p-6 shadow-sm" to="/my-events">
          <h3 className="text-lg font-semibold text-slate-900">My events</h3>
          <p className="mt-2 text-sm text-slate-600">Track upcoming and past hosted or joined events.</p>
        </Link>

        <Link className="rounded-3xl bg-white p-6 shadow-sm" to="/badges">
          <h3 className="text-lg font-semibold text-slate-900">Trust badges</h3>
          <p className="mt-2 text-sm text-slate-600">Review badge types and prepare for the application workflow.</p>
        </Link>
      </div>
    </section>
  );
}