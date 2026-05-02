import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarCheck,
  Heart,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { api } from "../lib/api";

function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="group rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-200/70 backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
        {icon}
      </div>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
    </article>
  );
}

export function HomePage() {
  const userSession = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const adminSession = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

  const isStudent = userSession.data?.authenticated === true;
  const isAdmin = adminSession.data?.authenticated === true && !isStudent;

  const primaryCta = isAdmin
    ? { label: "Open admin dashboard", to: "/admin/dashboard" }
    : isStudent
      ? { label: "Browse events", to: "/events" }
      : { label: "Browse events", to: "/events" };

  const secondaryCta = isAdmin
    ? { label: "Review badge queue", to: "/admin/dashboard" }
    : isStudent
      ? { label: "View my events", to: "/my-events" }
      : { label: "Create account", to: "/register" };

  return (
    <section className="space-y-10">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 p-8 text-white shadow-2xl shadow-slate-300 md:p-12">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute bottom-0 right-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
              <Sparkles size={16} />
              Campus workouts feel easier with a buddy
            </div>

            <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-6xl">
              Find reliable workout partners for gym sessions and outdoor runs.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Peer Fitness Buddy helps students create workout events, join classmates, manage
              their fitness schedule, and build safer campus routines with people from the same
              college community.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:bg-blue-500"
                to={primaryCta.to}
              >
                {primaryCta.label}
                <ArrowRight size={18} />
              </Link>

              <Link
                className="inline-flex min-w-44 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 font-black text-white shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15"
                to={secondaryCta.to}
              >
                <span>{secondaryCta.label}</span>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                    Sample preview
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    Not a live event
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                      Example event card
                    </p>
                    <h2 className="mt-1 text-2xl font-black">Beginner Gym Session</h2>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
                    Peer Trainer
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                    <CalendarCheck className="text-blue-600" size={20} />
                    <span className="text-sm font-bold">Tomorrow · Evening</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                    <MapPin className="text-blue-600" size={20} />
                    <span className="text-sm font-bold">Student Recreation Center</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                    <Users className="text-blue-600" size={20} />
                    <span className="text-sm font-bold">3 / 4 participants</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white">
                  <p className="text-sm font-bold">How events help</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Students can quickly understand who is hosting, where the workout happens, and
                    whether there is space to join.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <FeatureCard icon={<Users size={24} />} title="Create and join events">
          Students can post facility workouts or outdoor runs, then classmates can browse by time
          range and join events with available capacity.
        </FeatureCard>

        <FeatureCard icon={<MapPin size={24} />} title="Campus-aware locations">
          Facility events use the admin-managed facility list, while running events use a detailed
          location near the configured campus region.
        </FeatureCard>

        <FeatureCard icon={<ShieldCheck size={24} />} title="Trust badge review">
          Students can apply for credibility badges, and admins manually approve or deny each
          application before badges appear on posted events.
        </FeatureCard>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">
              Built for real campus routines
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">
              Simple enough for beginners, structured enough for hosts and admins.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              The app keeps student actions focused on finding workout partners, while admin
              accounts stay dedicated to facility management and trust badge review.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-blue-50 p-5">
              <Heart className="text-blue-600" size={24} />
              <p className="mt-3 font-black text-slate-950">Like past sessions</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Attendees can give a simple like to past events they joined.
              </p>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-5">
              <CalendarCheck className="text-emerald-600" size={24} />
              <p className="mt-3 font-black text-slate-950">Manage your schedule</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Hosts can cancel upcoming events and attendees can withdraw when needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
