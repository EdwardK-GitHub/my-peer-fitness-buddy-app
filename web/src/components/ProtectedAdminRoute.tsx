import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function ProtectedAdminRoute() {
  const location = useLocation();
  const session = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

  if (session.isLoading) {
    return <div className="rounded-2xl bg-white p-6 shadow-sm">Loading admin session…</div>;
  }

  if (!session.data?.authenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/admin/login" />;
  }

  return <Outlet />;
}