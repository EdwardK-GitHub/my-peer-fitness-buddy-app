import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Heart, XCircle, LogOut, Users, MapPin } from "lucide-react";

export function MyEventsPage() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const myEvents = useQuery({ queryKey: ["my-events"], queryFn: api.getMyEvents });

  const cancelMut = useMutation({ 
      mutationFn: api.cancelEvent, 
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-events"] }) 
  });
  const withdrawMut = useMutation({ 
      mutationFn: api.withdrawEvent, 
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-events"] }) 
  });
  const likeMut = useMutation({ 
      mutationFn: api.likeEvent, 
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-events"] }) 
  });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">My Events</h2>
        <p className="mt-2 text-sm text-slate-600">Manage the events you are hosting and the sessions you have joined.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* FReq 3.1: Upcoming Events */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border-t-4 border-blue-500">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Schedule</h3>
          <div className="space-y-4">
            {myEvents.data?.upcoming.map((evt) => {
              const isHost = evt.host.id === session.data?.user?.id;
              return (
                <article className={`rounded-2xl border p-5 transition ${evt.status === 'canceled' ? 'opacity-50 border-rose-200 bg-rose-50' : 'border-slate-200 hover:border-blue-200 hover:shadow-md'}`} key={evt.id}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="font-bold text-lg text-slate-900 flex items-center">
                            {evt.activityType} 
                            {isHost && <span className="bg-blue-100 text-blue-800 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ml-3 border border-blue-200">You are Host</span>}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-600">{new Date(evt.scheduledAt).toLocaleString()}</p>
                    </div>
                    {evt.status === 'canceled' && <span className="text-rose-600 text-xs font-bold px-2 py-1 bg-rose-100 rounded-md border border-rose-200">CANCELED</span>}
                  </div>
                  
                  <p className="text-slate-500 text-sm mt-3 flex items-center gap-1"><MapPin size={14}/> {evt.locationLabel}</p>

                  {/* FReq 3.4 Host sees attendees */}
                  {isHost && evt.attendees && evt.attendees.length > 0 && (
                    <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                       <p className="font-bold mb-2 flex items-center gap-1.5"><Users size={14}/> Joined Attendees ({evt.attendanceCount}):</p>
                       <ul className="space-y-1 pl-1">
                           {evt.attendees.map(a => <li key={a.id} className="font-medium">• {a.fullName}</li>)}
                       </ul>
                    </div>
                  )}

                  {/* Actions FReq 3.5 & 3.6 */}
                  <div className="mt-5 flex gap-2">
                     {isHost && evt.status !== 'canceled' && (
                        <button onClick={() => { if(window.confirm('Are you sure you want to cancel this event?')) cancelMut.mutate(evt.id); }} className="w-full text-rose-600 border border-rose-200 bg-rose-50 py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-rose-100 transition"><XCircle size={18}/> Cancel Event</button>
                     )}
                     {!isHost && evt.status !== 'canceled' && (
                        <button onClick={() => { if(window.confirm('Are you sure you want to withdraw?')) withdrawMut.mutate(evt.id); }} className="w-full text-slate-700 border border-slate-300 bg-white py-2 rounded-xl text-sm font-bold flex justify-center items-center gap-2 hover:bg-slate-50 transition"><LogOut size={18}/> Withdraw</button>
                     )}
                  </div>
                </article>
              );
            })}
            {myEvents.data?.upcoming.length === 0 && <p className="text-slate-500 text-center py-6 border border-dashed rounded-xl">Nothing scheduled.</p>}
          </div>
        </div>

        {/* FReq 3.2 & 5: Past Events & Likes */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border-t-4 border-slate-300">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Past History</h3>
          <div className="space-y-4">
            {myEvents.data?.past.map((evt) => {
               const isHost = evt.host.id === session.data?.user?.id;
               return (
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5" key={evt.id}>
                  <p className="font-bold text-slate-900 text-lg flex items-center">
                      {evt.activityType} 
                      {isHost && <span className="bg-slate-200 text-slate-700 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ml-3">Host</span>}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{new Date(evt.scheduledAt).toLocaleString()}</p>
                  
                  {/* FReq 5: Social Validation 'Like' mechanism */}
                  {!isHost && evt.status !== 'canceled' && (
                     <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
                        <button 
                           onClick={() => likeMut.mutate(evt.id)} 
                           disabled={evt.liked}
                           className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${evt.liked ? 'bg-pink-100 text-pink-600 border border-pink-200' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 shadow-sm'}`}>
                           <Heart size={18} fill={evt.liked ? "currentColor" : "none"} className={evt.liked ? "text-pink-500" : ""}/> 
                           {evt.liked ? "You Liked This!" : "Like this session"}
                        </button>
                        <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">{evt.likeCount} Likes</span>
                     </div>
                  )}
                  {isHost && (
                      <div className="mt-4 border-t border-slate-200 pt-3">
                          <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">{evt.likeCount} Likes Received</span>
                      </div>
                  )}
                </article>
               );
            })}
             {myEvents.data?.past.length === 0 && <p className="text-slate-500 text-center py-6 border border-dashed rounded-xl">No past history.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}