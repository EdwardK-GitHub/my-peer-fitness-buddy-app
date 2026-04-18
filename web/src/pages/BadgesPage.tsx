import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function BadgesPage() {
  const badgeTypes = useQuery({ queryKey: ["badge-types"], queryFn: api.getBadgeTypes });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Trust badges</h2>
        <p className="mt-2 text-sm text-slate-600">
          Badge types are connected to the API. Submission and admin review actions are reserved for the next development step.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {badgeTypes.data?.badgeTypes.map((badgeType) => (
          <article className="rounded-3xl bg-white p-6 shadow-sm" key={badgeType.id}>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{badgeType.code}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{badgeType.displayName}</h3>
            <p className="mt-2 text-sm text-slate-600">{badgeType.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}