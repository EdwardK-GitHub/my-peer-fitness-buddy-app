import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function ProtectedUserRoute() {
  const location = useLocation();
  const session = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });

  if (session.isLoading) {
    return <div className="rounded-2xl bg-white p-6 shadow-sm">Loading user session…</div>;
  }

  if (!session.data?.authenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}