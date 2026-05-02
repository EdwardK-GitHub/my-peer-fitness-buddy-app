import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Heart,
  Search,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";

import { api, type EventRecord } from "../lib/api";
import { formatEventDateTime } from "../lib/datetime";

function nextUpcomingEvent(events: EventRecord[] | undefined): EventRecord | null {
  if (!events || events.length === 0) {
    return null;
  }

  return events
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article className="rounded-3xl border border-white/80 bg-white p-5 shadow-sm">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
        {icon}
      </div>
      <p className="text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
    </article>
  );
}

function ActionCard({
  to,
  icon,
  title,
  description,
  cta,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
      to={to}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
        {icon}
      </div>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-600">
        {cta}
        <ArrowRight size={16} />
      </p>
    </Link>
  );
}

export function UserDashboardPage() {
  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const myEvents = useQuery({ queryKey: ["my-events"], queryFn: api.getMyEvents });
  const myBadgeApps = useQuery({
    queryKey: ["my-badge-applications"],
    queryFn: api.getMyBadgeApps,
  });

  const upcoming = myEvents.data?.upcoming ?? [];
  const past = myEvents.data?.past ?? [];
  const upcomingHosted = upcoming.filter((event) => event.isHost).length;
  const upcomingAttending = upcoming.filter((event) => !event.isHost).length;
  const likedPastEvents = past.filter((event) => event.liked).length;
  const submittedBadgeApps =
    myBadgeApps.data?.applications.filter((application) => application.status === "submitted")
      .length ?? 0;

  const nextEvent = nextUpcomingEvent(upcoming);

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-300">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-24 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
              <Sparkles size={16} />
              Student fitness hub
            </div>
            <h2 className="text-4xl font-black tracking-tight md:text-5xl">
              Welcome back, {session.data?.user?.fullName ?? "student"}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              Find a workout partner, manage events you host or attend, and keep track of trust
              badge applications from one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
              to="/events"
            >
              Browse events
              <ArrowRight size={18} />
            </Link>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-black text-white backdrop-blur transition hover:bg-white/15"
              to="/my-events"
            >
              View my events
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        <StatCard
          icon={<Trophy size={22} />}
          label="upcoming hosted"
          tone="bg-blue-100 text-blue-700"
          value={upcomingHosted}
        />
        <StatCard
          icon={<UserCheck size={22} />}
          label="upcoming joined"
          tone="bg-emerald-100 text-emerald-700"
          value={upcomingAttending}
        />
        <StatCard
          icon={<Heart size={22} />}
          label="liked past events"
          tone="bg-pink-100 text-pink-700"
          value={likedPastEvents}
        />
        <StatCard
          icon={<BadgeCheck size={22} />}
          label="pending badge apps"
          tone="bg-amber-100 text-amber-700"
          value={submittedBadgeApps}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <CalendarCheck size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-950">Next upcoming event</h3>
              <p className="text-sm text-slate-500">Your nearest hosted or joined event.</p>
            </div>
          </div>

          {nextEvent ? (
            <article className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-lg font-black text-slate-950">{nextEvent.activityType}</h4>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">
                  {nextEvent.isHost ? "Hosting" : "Attending"}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-700">
                {formatEventDateTime(nextEvent.scheduledAt)}
              </p>
              <p className="mt-2 text-sm text-slate-600">{nextEvent.locationLabel}</p>
              <p className="mt-2 text-sm text-slate-500">
                {nextEvent.participantCount} / {nextEvent.capacity} participants
              </p>
              <Link
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white"
                to="/my-events"
              >
                Manage schedule
                <ArrowRight size={16} />
              </Link>
            </article>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="font-black text-slate-900">No upcoming events yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Browse events or post your own workout to get started.
              </p>
              <Link
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white"
                to="/events"
              >
                Browse events
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-slate-950">Quick actions</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Shortcuts for the most common student tasks.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              to="/events"
            >
              <span className="inline-flex items-center gap-2">
                <Search size={18} />
                Find workouts
              </span>
              <ArrowRight size={16} />
            </Link>

            <Link
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              to="/my-events"
            >
              <span className="inline-flex items-center gap-2">
                <Users size={18} />
                Manage my events
              </span>
              <ArrowRight size={16} />
            </Link>

            <Link
              className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              to="/badges"
            >
              <span className="inline-flex items-center gap-2">
                <BadgeCheck size={18} />
                Apply for trust badges
              </span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ActionCard
          cta="Search upcoming events"
          description="Use filters and pagination to find gym sessions and outdoor runs that fit your schedule."
          icon={<Search size={24} />}
          title="Browse campus events"
          to="/events"
        />
        <ActionCard
          cta="Open my schedule"
          description="Separate hosted and attended events, then manage upcoming participation in smaller pages."
          icon={<CalendarCheck size={24} />}
          title="Manage event activity"
          to="/my-events"
        />
        <ActionCard
          cta="Review badge options"
          description="Submit trust badge applications that can add credibility to events you post."
          icon={<BadgeCheck size={24} />}
          title="Build trust"
          to="/badges"
        />
      </div>
    </section>
  );
}
