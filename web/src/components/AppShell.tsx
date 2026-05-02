import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dumbbell, ShieldCheck } from "lucide-react";

import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

type NavItem = {
  label: string;
  to: string;
};

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm"
    : "rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950";
}

export function AppShell() {
  // The shell is role-aware so students and admins see the navigation that matches their permissions.
  const navigate = useNavigate();
  const userSession = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const adminSession = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

  const userAuthenticated = userSession.data?.authenticated === true;
  const adminAuthenticated = adminSession.data?.authenticated === true;
  const hasRoleConflict = userAuthenticated && adminAuthenticated;

  const logoutUser = useMutation({
    mutationFn: async () => {
      const csrfToken = userSession.data?.user?.csrfToken;
      if (!csrfToken) return;
      await api.logoutUser(csrfToken);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session", "user"] });
      await queryClient.invalidateQueries({ queryKey: ["my-events"] });
      navigate("/");
    },
  });

  const logoutAdmin = useMutation({
    mutationFn: async () => {
      const csrfToken = adminSession.data?.admin?.csrfToken;
      if (!csrfToken) return;
      await api.logoutAdmin(csrfToken);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-facilities"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-badge-apps"] });
      navigate("/");
    },
  });

  const guestLinks: NavItem[] = [
    { label: "Home", to: "/" },
    { label: "Events", to: "/events" },
    { label: "Badges", to: "/badges" },
  ];

  const studentLinks: NavItem[] = [
    { label: "Events", to: "/events" },
    { label: "Badges", to: "/badges" },
    { label: "Dashboard", to: "/dashboard" },
    { label: "My Events", to: "/my-events" },
  ];

  const adminLinks: NavItem[] = [
    { label: "Locations", to: "/admin/locations" },
    { label: "Badges", to: "/admin/badges" },
  ];

  const navLinks = adminAuthenticated && !userAuthenticated
    ? adminLinks
    : userAuthenticated && !adminAuthenticated
      ? studentLinks
      : guestLinks;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f8fafc_32rem,#f8fafc_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link className="flex items-center gap-3" to="/">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300">
              <Dumbbell size={21} />
            </div>
            <p className="text-lg font-black leading-tight text-slate-950">
              Peer Fitness Buddy
            </p>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm">
            {navLinks.map((item) => (
              <NavLink className={navClass} key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {userAuthenticated && !adminAuthenticated ? (
              <>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                  Student: {userSession.data?.user?.fullName}
                </span>
                <button
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => logoutUser.mutate()}
                  type="button"
                >
                  Sign out
                </button>
              </>
            ) : null}

            {adminAuthenticated && !userAuthenticated ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
                  <ShieldCheck size={16} />
                  Admin: {adminSession.data?.admin?.fullName}
                </span>
                <button
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => logoutAdmin.mutate()}
                  type="button"
                >
                  Admin sign out
                </button>
              </>
            ) : null}

            {!userAuthenticated && !adminAuthenticated ? (
              <>
                <Link
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  to="/login"
                >
                  Sign in
                </Link>
                <Link
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                  to="/register"
                >
                  Create account
                </Link>
              </>
            ) : null}

            {hasRoleConflict ? (
              <>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">
                  Two sessions detected
                </span>
                <button
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => logoutUser.mutate()}
                  type="button"
                >
                  Sign out student
                </button>
                <button
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => logoutAdmin.mutate()}
                  type="button"
                >
                  Sign out admin
                </button>
              </>
            ) : null}
          </div>
        </div>

        {hasRoleConflict ? (
          <div className="border-t border-rose-100 bg-rose-50 px-6 py-3 text-center text-sm font-semibold text-rose-700">
            Student and admin sessions cannot be used at the same time. Sign out of one role before continuing.
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
