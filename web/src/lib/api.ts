export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  csrfToken: string;
};

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  fullName: string;
  csrfToken: string;
};

export type UserSessionResponse = {
  authenticated: boolean;
  user: AuthenticatedUser | null;
};

export type AdminSessionResponse = {
  authenticated: boolean;
  admin: AuthenticatedAdmin | null;
};

export type Facility = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  addressLine?: string | null;
};

export type EventRecord = {
  id: string;
  activityType: string;
  scheduledAt: string;
  capacity: number;
  status: string;
  locationType: string;
  locationLabel?: string | null;
  locationDetails?: string | null;
  attendanceCount: number;
  joined: boolean;
  host: { id: string; fullName: string };
  facility?: { id: string; name: string } | null;
};

export type BadgeType = {
  id: string;
  code: string;
  displayName: string;
  description?: string | null;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Centralize fetch behavior so auth cookies and JSON handling stay consistent.
  const headers = new Headers(init.headers ?? {});

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? "Request failed", data?.details);
  }

  return data as T;
}

export const api = {
  getUserSession: () => request<UserSessionResponse>("/api/auth/me"),
  registerUser: (input: { fullName: string; email: string; password: string }) =>
    request<{ user: AuthenticatedUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  loginUser: (input: { email: string; password: string }) =>
    request<{ user: AuthenticatedUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logoutUser: (csrfToken: string) =>
    request<void>("/api/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  getAdminSession: () => request<AdminSessionResponse>("/api/admin/session/me"),
  loginAdmin: (input: { email: string; password: string }) =>
    request<{ admin: AuthenticatedAdmin }>("/api/admin/session/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logoutAdmin: (csrfToken: string) =>
    request<void>("/api/admin/session/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  getFacilities: () => request<{ facilities: Facility[] }>("/api/facilities"),
  getEvents: () => request<{ events: EventRecord[] }>("/api/events"),
  getMyEvents: () => request<{ upcoming: EventRecord[]; past: EventRecord[] }>("/api/my-events"),
  getBadgeTypes: () => request<{ badgeTypes: BadgeType[] }>("/api/badge-types"),
};