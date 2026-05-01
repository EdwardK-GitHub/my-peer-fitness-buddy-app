import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white"
    : "rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100";
}

export function AppShell() {
  // The shell centralizes navigation and session display for students and admins.
  const navigate = useNavigate();
  const userSession = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const adminSession = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

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
      navigate("/");
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-6 py-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Peer Fitness Buddy App
            </p>
            <h1 className="text-xl font-bold text-slate-900">Campus fitness hub</h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink className={navClass} to="/">
              Home
            </NavLink>
            <NavLink className={navClass} to="/events">
              Events
            </NavLink>
            <NavLink className={navClass} to="/badges">
              Badges
            </NavLink>
            <NavLink className={navClass} to="/dashboard">
              Dashboard
            </NavLink>
            <NavLink className={navClass} to="/my-events">
              My Events
            </NavLink>
            <NavLink className={navClass} to="/admin/login">
              Admin
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 text-sm text-slate-600">
        <div>
          {userSession.data?.authenticated ? (
            <span>Signed in as {userSession.data.user?.fullName}</span>
          ) : adminSession.data?.authenticated ? (
            <span>Admin: {adminSession.data.admin?.fullName}</span>
          ) : (
            <span>Sign in to post, join, and manage events.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {userSession.data?.authenticated ? (
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => logoutUser.mutate()}
              type="button"
            >
              Sign out
            </button>
          ) : null}

          {adminSession.data?.authenticated ? (
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => logoutAdmin.mutate()}
              type="button"
            >
              Admin sign out
            </button>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-10">
        <Outlet />
      </main>
    </div>
  );
}
