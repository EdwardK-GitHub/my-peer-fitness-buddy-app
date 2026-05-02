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

export type FacilityInput = {
  name: string;
  addressLine?: string;
  description?: string;
};

export type UsStateOption = {
  code: string;
  name: string;
};

export type SettingsResponse = {
  allowedStates: string[];
  stateOptions: UsStateOption[];
  regionLimit: string;
};

export type LocationSuggestion = {
  label: string;
  lat: number;
  lng: number;
  stateCode: string;
  stateName: string;
};

export type HostBadge = {
  code: string;
  displayName: string;
};

export type EventRecord = {
  id: string;
  activityType: string;
  scheduledAt: string;
  capacity: number;
  status: string;
  locationType: "facility" | "running" | string;
  locationLabel?: string | null;
  locationDetails?: string | null;
  notes?: string | null;
  attendeeCount: number;
  participantCount: number;
  attendanceCount: number;
  spotsRemaining: number;
  joined: boolean;
  isHost: boolean;
  isPast: boolean;
  liked: boolean;
  likeCount: number;
  canJoin: boolean;
  canWithdraw: boolean;
  canCancel: boolean;
  host: { id: string; fullName: string; badges: HostBadge[] };
  facility?: { id: string; name: string } | null;
  attendees?: { id: string; fullName: string }[];
};

export type CreateEventInput = {
  activityType: string;
  scheduledAt: string;
  capacity: number;
  locationType: "facility" | "running";
  facilityId?: string;
  locationLabel?: string;
  locationDetails?: string;
  notes?: string;
};

export type BadgeType = {
  id: string;
  code: string;
  displayName: string;
  description?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
};

export type BadgeAppRecord = {
  id: string;
  status: "submitted" | "approved" | "denied" | string;
  badgeTypeId: string;
  badgeTypeCode: string;
  badgeName: string;
  message: string;
  decisionNotes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  applicantName?: string | null;
  applicantEmail?: string | null;
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

  getSettings: () => request<SettingsResponse>("/api/settings"),
  updateSettings: (allowedStates: string[]) =>
    request<SettingsResponse & { message: string }>("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ allowedStates }),
    }),

  getFacilities: () => request<{ facilities: Facility[] }>("/api/facilities"),
  getAdminFacilities: () => request<{ facilities: Facility[] }>("/api/admin/facilities"),
  createFacility: (input: FacilityInput) =>
    request<{ message: string; facility: Facility }>("/api/admin/facilities", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateFacility: (
    id: string,
    input: Partial<FacilityInput> & { isActive?: boolean },
  ) =>
    request<{ message: string; facility: Facility }>(`/api/admin/facilities/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deactivateFacility: (id: string) =>
    request<{ message: string; facility: Facility }>(`/api/admin/facilities/${id}`, {
      method: "DELETE",
    }),

  autocompleteLocations: (query: string) => {
    const search = new URLSearchParams({ q: query });
    return request<{ suggestions: LocationSuggestion[] }>(
      `/api/locations/autocomplete?${search.toString()}`,
    );
  },

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
  createEvent: (input: CreateEventInput) =>
    request<{ message: string; eventId: string }>("/api/events", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  joinEvent: (id: string) => request<void>(`/api/events/${id}/join`, { method: "POST" }),
  withdrawEvent: (id: string) =>
    request<void>(`/api/events/${id}/withdraw`, { method: "POST" }),
  cancelEvent: (id: string) => request<void>(`/api/events/${id}/cancel`, { method: "POST" }),
  likeEvent: (id: string) => request<void>(`/api/events/${id}/like`, { method: "POST" }),

  getBadgeTypes: () => request<{ badgeTypes: BadgeType[] }>("/api/badge-types"),
  getAdminBadgeTypes: () => request<{ badgeTypes: BadgeType[] }>("/api/admin/badge-types"),
  createBadgeType: (input: { displayName: string; description?: string }) =>
    request<{ message: string; badgeType: BadgeType }>("/api/admin/badge-types", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateBadgeType: (
    id: string,
    input: { displayName?: string; description?: string; isActive?: boolean },
  ) =>
    request<{ message: string; badgeType: BadgeType }>(`/api/admin/badge-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteBadgeType: (id: string) =>
    request<{ message: string; badgeType: BadgeType }>(`/api/admin/badge-types/${id}`, {
      method: "DELETE",
    }),
  getMyBadgeApps: () => request<{ applications: BadgeAppRecord[] }>("/api/badge-applications"),
  submitBadgeApp: (input: { badgeTypeId: string; message: string }) =>
    request<{ message: string; status: string; applicationId: string }>("/api/badge-applications", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getBadgeApps: () => request<{ applications: BadgeAppRecord[] }>("/api/admin/badge-applications"),
  reviewBadgeApp: (
    id: string,
    input: { status: "approved" | "denied"; decisionNotes?: string },
  ) =>
    request<{ message: string; status: string }>(`/api/admin/badge-applications/${id}/review`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
