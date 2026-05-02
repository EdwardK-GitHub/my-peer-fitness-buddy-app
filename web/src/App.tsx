import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { ProtectedUserRoute } from "./components/ProtectedUserRoute";
import { AdminBadgesPage } from "./pages/AdminBadgesPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminLocationsPage } from "./pages/AdminLocationsPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { BadgesPage } from "./pages/BadgesPage";
import { EventsPage } from "./pages/EventsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MyEventsPage } from "./pages/MyEventsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { UserDashboardPage } from "./pages/UserDashboardPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />} path="/">
        <Route element={<HomePage />} index />
        <Route element={<EventsPage />} path="events" />
        <Route element={<BadgesPage />} path="badges" />
        <Route element={<LoginPage />} path="login" />
        <Route element={<RegisterPage />} path="register" />
        <Route element={<AdminLoginPage />} path="admin/login" />

        <Route element={<ProtectedUserRoute />}>
          <Route element={<UserDashboardPage />} path="dashboard" />
          <Route element={<MyEventsPage />} path="my-events" />
        </Route>

        <Route element={<ProtectedAdminRoute />}>
          <Route element={<AdminDashboardPage />} path="admin/dashboard" />
          <Route element={<AdminLocationsPage />} path="admin/locations" />
          <Route element={<AdminBadgesPage />} path="admin/badges" />
        </Route>
      </Route>
    </Routes>
  );
}