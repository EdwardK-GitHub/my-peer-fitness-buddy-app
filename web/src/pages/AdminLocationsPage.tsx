import { FacilityManager } from "../components/admin/FacilityManager";
import { RunningStateSettings } from "../components/admin/RunningStateSettings";

export function AdminLocationsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
          Admin locations
        </p>
        <h2 className="mt-2 text-3xl font-black">Location Settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Manage outdoor-run state restrictions and the active campus facility list.
        </p>
      </div>

      <RunningStateSettings />
      <FacilityManager />
    </section>
  );
}
