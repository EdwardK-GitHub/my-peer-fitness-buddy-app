import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function AdminDashboardPage() {
  const facilities = useQuery({ queryKey: ["admin-facilities"], queryFn: api.getFacilities });
  const admin = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Admin dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {admin.data?.admin?.fullName}. Facility editing and badge review write-actions are wired for the next development step.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Facility snapshot</h3>
        <div className="mt-4 space-y-3">
          {facilities.data?.facilities.map((facility) => (
            <article className="rounded-2xl border border-slate-200 p-4" key={facility.id}>
              <p className="font-medium text-slate-900">{facility.name}</p>
              <p className="mt-1 text-sm text-slate-600">{facility.addressLine}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}