import { BadgeTypeManager } from "../components/admin/BadgeTypeManager";
import { BadgeApplicationQueue } from "../components/admin/BadgeApplicationQueue";

export function AdminBadgesPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
          Admin badges
        </p>
        <h2 className="mt-2 text-3xl font-black">Badge Settings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Manage trust badge types and manually review student badge applications.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <BadgeTypeManager />
        <BadgeApplicationQueue />
      </div>
    </section>
  );
}
