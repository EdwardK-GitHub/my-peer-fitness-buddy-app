import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <section className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-300">College fitness coordination</p>
        <h2 className="mt-3 text-4xl font-semibold">Find workout partners, manage events, and grow the app with your team.</h2>
        <p className="mt-4 max-w-2xl text-base text-slate-200">
          This workspace includes a complete baseline for user registration and login, seeded accounts,
          and the full project shape for events, facilities, badges, and admin flows.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-xl bg-white px-4 py-3 font-semibold text-slate-900" to="/register">
            Create user account
          </Link>
          <Link className="rounded-xl border border-slate-600 px-4 py-3 font-semibold text-white" to="/login">
            User sign in
          </Link>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Included in this codebase</h3>
        <ul className="mt-4 space-y-3 text-sm text-slate-700">
          <li>• Separate user and admin session flows</li>
          <li>• PostgreSQL schema for users, events, facilities, badges, and audit logs</li>
          <li>• Seed data for test runs</li>
          <li>• Placeholder pages and API routes for the remaining project requirements</li>
        </ul>
      </div>
    </section>
  );
}