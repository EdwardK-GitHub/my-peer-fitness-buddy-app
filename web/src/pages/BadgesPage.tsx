import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ShieldCheck } from "lucide-react";

export function BadgesPage() {
  const queryClient = useQueryClient();
  const badgeTypes = useQuery({ queryKey: ["badge-types"], queryFn: api.getBadgeTypes });
  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });

  const [message, setMessage] = useState("");
  const [selectedBadge, setSelectedBadge] = useState("");

  const submitMut = useMutation({
    mutationFn: api.submitBadgeApp,
    onSuccess: () => { 
        alert("Success! Your application has been sent to the Admins for review."); 
        setMessage(""); 
        setSelectedBadge(""); 
    },
    onError: (e: any) => alert(e.message)
  });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm flex items-center gap-4">
        <div className="bg-amber-100 p-3 rounded-2xl"><ShieldCheck size={32} className="text-amber-600"/></div>
        <div>
            <h2 className="text-2xl font-semibold text-slate-900">Trust Badges</h2>
            <p className="mt-1 text-sm text-slate-600">Apply for verification to increase your credibility as a workout partner.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
           {badgeTypes.data?.badgeTypes.map((b) => (
             <article className={`rounded-3xl p-6 shadow-sm border transition-all ${selectedBadge === b.id ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' : 'bg-white border-slate-200 hover:border-amber-200 cursor-pointer'}`} key={b.id} onClick={() => setSelectedBadge(b.id)}>
               <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">{b.displayName}</h3>
               <p className="mt-2 text-sm font-medium text-slate-600">{b.description}</p>
               {session.data?.authenticated && (
                  <div className="mt-4 flex justify-end">
                      <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg ${selectedBadge === b.id ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                          {selectedBadge === b.id ? "Selected" : "Select to Apply"}
                      </span>
                  </div>
               )}
             </article>
           ))}
        </div>

        {/* FReq 6.1 Application Form */}
        {selectedBadge && session.data?.authenticated ? (
           <div className="rounded-3xl bg-slate-900 p-8 shadow-lg text-white h-fit sticky top-6">
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2"><ShieldCheck size={20}/> Submit Application</h3>
              <p className="text-sm text-slate-400 mb-6">Briefly explain why you qualify for this badge. Admins will manually review your request.</p>
              
              <textarea 
                 value={message} 
                 onChange={e => setMessage(e.target.value)} 
                 placeholder="I have 3 years of weightlifting experience..." 
                 className="w-full h-40 rounded-2xl bg-slate-800 border border-slate-700 p-4 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500 mb-6 resize-none"
              />
              <button 
                 onClick={() => submitMut.mutate({badgeTypeId: selectedBadge, message})}
                 disabled={submitMut.isPending || !message.trim()}
                 className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-slate-100 transition disabled:opacity-50"
              >
                 {submitMut.isPending ? "Submitting..." : "Submit to Admin"}
              </button>
           </div>
        ) : (
            <div className="rounded-3xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 font-medium p-8 text-center h-48">
                {session.data?.authenticated ? "Select a badge from the list to apply." : "Sign in to apply for trust badges."}
            </div>
        )}
      </div>
    </section>
  );
}