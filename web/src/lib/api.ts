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
  isActive?: boolean;
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
  liked: boolean;
  likeCount: number;
  host: { id: string; fullName: string; badges: string[] };
  facility?: { id: string; name: string } | null;
  attendees?: { id: string; fullName: string }[];
};

export type BadgeType = {
  id: string;
  code: string;
  displayName: string;
  description?: string | null;
};

export type BadgeAppRecord = {
  id: string;
  status: string;
  applicantName: string;
  badgeName: string;
  message: string;
  createdAt: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  // Admin Settings
  getSettings: () => request<{regionLimit: string}>("/api/settings"),
  updateSettings: (regionLimit: string) => request<void>("/api/admin/settings", { 
      method: "PUT", body: JSON.stringify({regionLimit}) 
  }),

  // Facilities
  getFacilities: () => request<{ facilities: Facility[] }>("/api/facilities"),
  getAdminFacilities: () => request<{ facilities: Facility[] }>("/api/admin/facilities"),
  createFacility: (input: {name: string, addressLine: string}) => request<void>("/api/admin/facilities", { 
      method: "POST", body: JSON.stringify(input) 
  }),
  updateFacility: (id: string, input: { name?: string; addressLine?: string; description?: string; isActive?: boolean }) =>
    request<void>(`/api/admin/facilities/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deactivateFacility: (id: string) => request<void>(`/api/admin/facilities/${id}`, { method: "DELETE" }),

  // Events
  getEvents: (params?: {
    from?: string;
    to?: string;
    q?: string;
    locationType?: string;
    limit?: number;
    offset?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.q) search.set("q", params.q);
    if (params?.locationType) search.set("locationType", params.locationType);
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.offset != null) search.set("offset", String(params.offset));
    const qs = search.toString();
    return request<{ events: EventRecord[]; total: number }>(`/api/events${qs ? `?${qs}` : ""}`);
  },
  getMyEvents: () => request<{ upcoming: EventRecord[]; past: EventRecord[] }>("/api/my-events"),
  createEvent: (input: any) => request<void>("/api/events", { method: "POST", body: JSON.stringify(input) }),
  joinEvent: (id: string) => request<void>(`/api/events/${id}/join`, { method: "POST" }),
  withdrawEvent: (id: string) => request<void>(`/api/events/${id}/withdraw`, { method: "POST" }),
  cancelEvent: (id: string) => request<void>(`/api/events/${id}/cancel`, { method: "POST" }),
  likeEvent: (id: string) => request<void>(`/api/events/${id}/like`, { method: "POST" }),

  // Badges
  getBadgeTypes: () => request<{ badgeTypes: BadgeType[] }>("/api/badge-types"),
  submitBadgeApp: (input: {badgeTypeId: string, message: string}) => request<void>("/api/badge-applications", { 
      method: "POST", body: JSON.stringify(input) 
  }),
  getBadgeApps: () => request<{ applications: BadgeAppRecord[] }>("/api/admin/badge-applications"),
  reviewBadgeApp: (id: string, status: string) => request<void>(`/api/admin/badge-applications/${id}/review`, { 
      method: "POST", body: JSON.stringify({status}) 
  }),
};