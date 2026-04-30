import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { LocationSelector } from "../components/LocationSelector";
import { CheckCircle2, UserPlus, MapPin, X, Search } from "lucide-react";

const PAGE_SIZE = 20;

export function EventsPage() {
  const queryClient = useQueryClient();

  // FReq 2.1: Time ranges
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // FReq 2: Keyword and location-type filterss
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationTypeFilter, setLocationTypeFilter] = useState(""); // "", "facility", "running"
  const [page, setPage] = useState(0);

  // Debounce the keyword
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change resets pagination back to page 0
  useEffect(() => {
    setPage(0);
  }, [filterFrom, filterTo, debouncedSearch, locationTypeFilter]);

  const events = useQuery({
    queryKey: ["events", filterFrom, filterTo, debouncedSearch, locationTypeFilter, page],
    queryFn: () => api.getEvents({
      from: filterFrom ? filterFrom + ":00Z" : undefined,
      to: filterTo ? filterTo + ":00Z" : undefined,
      q: debouncedSearch || undefined,
      locationType: locationTypeFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    placeholderData: (prev) => prev, // while the next one loads, keep the current page visible
  });

  const eventList = events.data?.events ?? [];
  const total = events.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  const hasActiveFilters = !!(filterFrom || filterTo || searchInput || locationTypeFilter);
  const clearAllFilters = () => {
    setFilterFrom("");
    setFilterTo("");
    setSearchInput("");
    setLocationTypeFilter("");
  };
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: api.getFacilities });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });

  // FReq 1: Create Event State
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ activityType: "", scheduledAt: "", capacity: 2, locationType: "facility", facilityId: "", locationLabel: "", locationDetails: "" });

  const createMut = useMutation({
    mutationFn: api.createEvent,
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ["events"] }); 
        setShowCreate(false); 
        alert("Event successfully posted!");
    },
    onError: (e: any) => alert(e.message)
  });

  const joinMut = useMutation({
    mutationFn: api.joinEvent,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["my-events"] });
    },
    onError: (e: any) => alert(e.message)
  });

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Events</h2>
          <p className="mt-2 text-sm text-slate-600">Browse and join campus fitness activities.</p>
        </div>
        {session.data?.authenticated && (
          <button onClick={() => setShowCreate(!showCreate)} className={`px-5 py-2 rounded-xl font-medium transition flex items-center gap-2 ${showCreate ? 'bg-slate-100 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {showCreate ? <><X size={18}/> Cancel</> : "+ Post Event"}
          </button>
        )}
      </div>

      {/* FReq 1: Event Creation Form */}
      {showCreate && (
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-blue-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Create an Event</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Activity Type</label>
              <input type="text" placeholder="e.g. Morning Run, Heavy Lifting" className="w-full border rounded-xl px-4 py-2 mt-1 outline-none focus:border-slate-900" onChange={e => setForm({...form, activityType: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Date & Time</label>
              <input type="datetime-local" className="w-full border rounded-xl px-4 py-2 mt-1 outline-none focus:border-slate-900" onChange={e => setForm({...form, scheduledAt: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Capacity (Participants)</label>
              <input type="number" placeholder="Capacity" min="2" className="w-full border rounded-xl px-4 py-2 mt-1 outline-none focus:border-slate-900" onChange={e => setForm({...form, capacity: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Location Type</label>
              <select className="w-full border rounded-xl px-4 py-2 mt-1 outline-none focus:border-slate-900 bg-white" onChange={e => setForm({...form, locationType: e.target.value})}>
                <option value="facility">College Facility</option>
                <option value="running">Outdoor Run (Map)</option>
              </select>
            </div>
          </div>

          {form.locationType === "facility" ? (
             <div className="mb-4">
               <label className="text-xs font-semibold text-slate-500 uppercase">Select Facility (FReq 1.3)</label>
               <select className="w-full border rounded-xl px-4 py-2 mt-1 outline-none focus:border-slate-900 bg-white" onChange={e => setForm({...form, facilityId: e.target.value})}>
                  <option value="">Choose an approved facility...</option>
                  {facilities.data?.facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
               </select>
             </div>
          ) : (
             <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Choose Run Location (FReq 1.4)</label>
                <LocationSelector regionLimit={settings.data?.regionLimit || "USA"} onSelect={(lbl, lat, lng) => setForm({...form, locationLabel: lbl, locationDetails: JSON.stringify({lat, lng})})} />
             </div>
          )}

          <button onClick={() => createMut.mutate({...form, scheduledAt: form.scheduledAt+":00Z"})} disabled={createMut.isPending} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50">
            {createMut.isPending ? "Publishing..." : "Publish Event"}
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* FReq 2: Event Browsing List */}
        <div>
           {/* FReq 2.1 and 2.2, Search and Filters */}
           <div className="mb-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              {/* Keyword search (activity, location, host) */}
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by activity, location, or host..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
                />
              </div>

              {/* Time range + location type */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">When:</span>
                  <input type="datetime-local" className="border rounded-lg px-3 py-1 text-sm text-slate-600" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From"/>
                  <span className="text-sm text-slate-400">to</span>
                  <input type="datetime-local" className="border rounded-lg px-3 py-1 text-sm text-slate-600" value={filterTo} onChange={e => setFilterTo(e.target.value)} title="To"/>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Type:</span>
                  <select
                    value={locationTypeFilter}
                    onChange={(e) => setLocationTypeFilter(e.target.value)}
                    className="border rounded-lg px-2 py-1 text-sm text-slate-600 bg-white"
                  >
                    <option value="">All</option>
                    <option value="facility">Facility</option>
                    <option value="running">Outdoor Run</option>
                  </select>
                </div>
                {hasActiveFilters && (
                  <button onClick={clearAllFilters} className="text-sm text-blue-600 hover:underline ml-auto">
                    Clear all
                  </button>
                )}
              </div>

              {/* Result count */}
              <div className="text-xs text-slate-500">
                {total === 0
                  ? "0 events found"
                  : `Showing ${rangeStart}\u2013${rangeEnd} of ${total} event${total !== 1 ? "s" : ""}`}
                {events.isFetching && <span className="ml-2 text-slate-400">updating...</span>}
              </div>
           </div>

           <div className="space-y-4">
              {eventList.map((evt) => (
                <article className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 ${evt.status === 'canceled' ? 'border-rose-200 opacity-60' : 'border-slate-200'}`} key={evt.id}>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-900">{evt.activityType}</h3>
                      {evt.host.badges?.includes("peer_trainer") && <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle2 size={14}/> Peer Trainer</span>}
                    </div>
                    <p className="text-slate-500 text-sm mt-1">{new Date(evt.scheduledAt).toLocaleString()}</p>
                    <p className="text-slate-700 font-medium mt-3 flex items-center gap-1"><MapPin size={16} className="text-blue-500"/> {evt.locationLabel}</p>
                    <p className="text-slate-500 text-sm mt-1">Host: {evt.host.fullName}</p>
                  </div>
                  
                  <div className="text-left md:text-right bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                    <p className="text-sm font-medium text-slate-700 mb-2">{evt.attendanceCount} / {evt.capacity} Joined</p>
                    {session.data?.authenticated ? (
                      evt.joined ? (
                        <span className="text-green-600 font-bold flex items-center md:justify-end gap-1"><CheckCircle2 size={18}/> You Joined</span>
                      ) : evt.status === 'canceled' ? (
                        <span className="text-rose-500 font-bold px-3 py-1 bg-rose-50 rounded-lg">Canceled</span>
                      ) : evt.attendanceCount >= evt.capacity ? (
                        <span className="text-slate-500 font-bold px-3 py-1 bg-slate-100 rounded-lg">At Capacity</span>
                      ) : (
                        <button onClick={() => joinMut.mutate(evt.id)} className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-xl font-bold hover:bg-blue-100 transition flex items-center gap-2"><UserPlus size={18}/> Join Workout</button>
                      )
                    ) : (
                       <span className="text-slate-400 text-sm italic">Sign in to join</span>
                    )}
                  </div>
                </article>
              ))}
              {eventList.length === 0 && (
                <p className="text-center text-slate-500 py-10 bg-white rounded-2xl border border-slate-200">
                  {hasActiveFilters ? "No events match your search." : "No events found."}
                </p>
              )}

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page + 1 >= totalPages}
                      className="px-3 py-1 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
           </div>
        </div>

        {/* Informational Sidebar */}
        <div className="rounded-3xl bg-slate-900 p-6 shadow-sm text-white h-fit">
          <h3 className="text-lg font-semibold mb-4">Active Facilities</h3>
          <div className="space-y-4">
            {facilities.data?.facilities.map((facility) => (
              <article className="border-b border-slate-700 pb-3 last:border-0" key={facility.id}>
                <p className="font-semibold">{facility.name}</p>
                <p className="mt-1 text-xs text-slate-400">{facility.addressLine}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}