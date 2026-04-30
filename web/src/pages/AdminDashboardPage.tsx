import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { CheckCircle2, XCircle, Trash2, MapPin, ShieldAlert, Plus, Pencil } from "lucide-react";

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const facilities = useQuery({ queryKey: ["admin-facilities"], queryFn: api.getAdminFacilities });
  const badgeApps = useQuery({ queryKey: ["admin-badge-apps"], queryFn: api.getBadgeApps });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [successMessage, setSuccessMessage] = useState("");

  // FReq 4 Mutations
  const [facName, setFacName] = useState("");
  const [facAddress, setFacAddress] = useState("");
  const createFacMut = useMutation({ mutationFn: api.createFacility, onSuccess: () => {queryClient.invalidateQueries({queryKey: ["admin-facilities"]}); setFacName(""); setFacAddress("");} });
  const deactivateFacMut = useMutation({
    mutationFn: api.deactivateFacility,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ["admin-facilities"]});
      setSuccessMessage("Facility deactivated.");
    },
  });
  const updateFacMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; addressLine?: string; description?: string; isActive?: boolean } }) => api.updateFacility(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: ["admin-facilities"]});
      if (variables.payload.isActive === true) {
        setSuccessMessage("Facility reactivated.");
      } else {
        setSuccessMessage("Facility updated.");
      }
    },
  });
  
  // Settings Mutation FReq 4
  const [limit, setLimit] = useState("");
  const updateSettingsMut = useMutation({ mutationFn: api.updateSettings, onSuccess: () => {queryClient.invalidateQueries({queryKey: ["settings"]}); alert("Saved!");} });

  // FReq 6.4 Review Mutation
  const reviewMut = useMutation({ mutationFn: ({id, status}: {id:string, status:string}) => api.reviewBadgeApp(id, status), onSuccess: () => queryClient.invalidateQueries({queryKey: ["admin-badge-apps"]}) });

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-slate-900 text-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">Admin Command Center</h2>
        <p className="mt-2 text-sm text-slate-400">Oversee locations, settings, and student applications.</p>
      </div>
      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
         {/* FReq 4: Facility & Region Management */}
         <div className="space-y-6">
             <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin size={20}/> Location Settings</h3>
                
                {/* Global App Settings for Running Limits */}
                <div className="mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                   <p className="text-sm font-bold text-slate-900 mb-1">Geographic Limit for Outdoor Runs</p>
                   <p className="text-xs text-slate-500 mb-3">Restrict user map searches to this boundary (e.g., "New York State").</p>
                   <div className="flex gap-2">
                      <input type="text" placeholder={settings.data?.regionLimit || "New York State, US"} value={limit} onChange={e => setLimit(e.target.value)} className="flex-1 border border-slate-300 outline-none focus:border-slate-900 px-4 py-2 rounded-xl text-sm font-medium" />
                      <button onClick={() => updateSettingsMut.mutate(limit)} disabled={!limit} className="bg-slate-900 text-white px-5 font-bold rounded-xl text-sm disabled:opacity-50 transition">Save</button>
                   </div>
                </div>

                <hr className="my-6 border-slate-100" />

                <h4 className="text-md font-bold text-slate-900 mb-3">Athletic Facilities List</h4>
                
                {/* FReq 4.2: Add Facility Form */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                       <input type="text" value={facName} onChange={e => setFacName(e.target.value)} placeholder="Facility Name" className="border px-3 py-2 rounded-xl text-sm outline-none" />
                       <input type="text" value={facAddress} onChange={e => setFacAddress(e.target.value)} placeholder="Address" className="border px-3 py-2 rounded-xl text-sm outline-none" />
                       <button onClick={() => createFacMut.mutate({name: facName, addressLine: facAddress})} disabled={!facName} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl text-sm font-bold flex items-center gap-1 disabled:opacity-50"><Plus size={16}/> Add</button>
                    </div>
                </div>

                {/* FReq 4.4 Deactivate Facility */}
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                   {facilities.data?.facilities.map(f => (
                      <div key={f.id} className={`flex justify-between items-center p-4 border rounded-2xl transition ${!f.isActive ? 'bg-slate-50 opacity-60 border-dashed' : 'border-slate-200 hover:border-slate-300'}`}>
                         <div>
                            <p className="text-sm font-bold text-slate-900">{f.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{f.addressLine}</p>
                         </div>
                         <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const nextName = window.prompt("Edit facility name", f.name);
                                if (nextName === null) return;
                                const nextAddress = window.prompt("Edit facility address", f.addressLine ?? "");
                                if (nextAddress === null) return;
                                const currentDescription = typeof f.description === "string" ? f.description : "";
                                const nextDescription = window.prompt("Edit facility description (can be empty)", currentDescription);
                                if (nextDescription === null) return;
                                updateFacMut.mutate({ id: f.id, payload: { name: nextName, addressLine: nextAddress, description: nextDescription } });
                              }}
                              className="text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            {f.isActive ? (
                                <button onClick={() => { if(window.confirm('Deactivate facility?')) deactivateFacMut.mutate(f.id); }} className="text-rose-500 border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"><Trash2 size={14}/> Remove</button>
                            ) : (
                                <>
                                  <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded">INACTIVE</span>
                                  <button
                                    onClick={() => updateFacMut.mutate({ id: f.id, payload: { isActive: true } })}
                                    className="text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                  >
                                    Reactivate
                                  </button>
                                </>
                            )}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
         </div>

         {/* FReq 6.4: Badge Review Queue */}
         <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><ShieldAlert size={20}/> Action Queue: Badges</h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
               {badgeApps.data?.applications.map(app => (
                  <article key={app.id} className={`p-5 border rounded-2xl ${app.status === 'submitted' ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                     <div className="flex justify-between items-start mb-3">
                        <div>
                            <span className="font-bold text-slate-900 text-sm block">{app.applicantName}</span>
                            <span className="text-xs font-medium text-slate-500">{new Date(app.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border ${app.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : app.status === 'denied' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-blue-200 text-blue-800 border-blue-300'}`}>{app.status}</span>
                     </div>
                     <p className="text-xs font-bold text-slate-700 mb-1 border-t border-slate-200/50 pt-2">Requested: {app.badgeName}</p>
                     <div className="text-sm text-slate-700 bg-white p-3 rounded-xl border border-slate-200 italic leading-relaxed">"{app.message}"</div>
                     
                     {app.status === 'submitted' && (
                        <div className="mt-4 flex gap-2">
                           <button onClick={() => reviewMut.mutate({id: app.id, status: "approved"})} className="flex-1 bg-green-600 hover:bg-green-700 transition text-white py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-1 shadow-sm"><CheckCircle2 size={16}/> Approve</button>
                           <button onClick={() => reviewMut.mutate({id: app.id, status: "denied"})} className="flex-1 bg-rose-600 hover:bg-rose-700 transition text-white py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-1 shadow-sm"><XCircle size={16}/> Deny</button>
                        </div>
                     )}
                  </article>
               ))}
               {badgeApps.data?.applications.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No applications in queue.</p>}
            </div>
         </div>
      </div>
    </section>
  );
}