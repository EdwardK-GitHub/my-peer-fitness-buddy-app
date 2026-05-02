import { Link } from "react-router-dom";
import { BadgeCheck, MapPinned } from "lucide-react";

export function AdminDashboardPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
          Admin overview
        </p>
        <h2 className="mt-2 text-3xl font-black">Admin Command Center</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Choose the admin area you want to manage.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          className="group rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
          to="/admin/locations"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
            <MapPinned size={24} />
          </div>
          <h3 className="text-xl font-black text-slate-950">Location Settings</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Manage allowed outdoor-run states and campus athletic facilities.
          </p>
        </Link>

        <Link
          className="group rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
          to="/admin/badges"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 transition group-hover:bg-amber-500 group-hover:text-white">
            <BadgeCheck size={24} />
          </div>
          <h3 className="text-xl font-black text-slate-950">Badge Settings</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Manage trust badge types and review student applications.
          </p>
        </Link>
      </div>
    </section>
  );
}
