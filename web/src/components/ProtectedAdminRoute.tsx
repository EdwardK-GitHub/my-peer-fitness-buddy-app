import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function ProtectedAdminRoute() {
  const location = useLocation();
  const userSession = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const adminSession = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

  if (userSession.isLoading || adminSession.isLoading) {
    return <div className="rounded-2xl bg-white p-6 shadow-sm">Checking admin session…</div>;
  }

  if (userSession.data?.authenticated && !adminSession.data?.authenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  if (!adminSession.data?.authenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/admin/login" />;
  }

  return <Outlet />;
}
