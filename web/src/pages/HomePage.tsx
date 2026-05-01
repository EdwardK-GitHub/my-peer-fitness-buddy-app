import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <section className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
          College fitness coordination
        </p>
        <h2 className="mt-3 text-4xl font-bold leading-tight">
          Find workout partners for gym sessions and outdoor runs.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
          Create events, join classmates, manage your schedule, and build safer fitness habits with
          peers from your campus community.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-2xl bg-white px-5 py-3 font-bold text-slate-900" to="/events">
            Browse events
          </Link>
          <Link
            className="rounded-2xl border border-slate-600 px-5 py-3 font-bold text-white hover:bg-slate-800"
            to="/register"
          >
            Create account
          </Link>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900">What you can do</h3>
        <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
          <li>• Post facility workouts or outdoor runs with a clear time, capacity, and location.</li>
          <li>• Search upcoming events by time range and join sessions with open spots.</li>
          <li>• Track events you host or attend from your personal schedule.</li>
          <li>• Apply for trust badges that help other students recognize approved peers.</li>
        </ul>
      </div>
    </section>
  );
}
