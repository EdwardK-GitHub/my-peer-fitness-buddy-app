/**
 * Shared date/time helpers for event flows.
 *
 * FReq 1, FReq 2, and FReq 3 all depend on consistent event time handling. Browser
 * datetime-local inputs do not include timezone text, so the frontend converts the user's
 * local time into a UTC ISO string before sending it to the backend.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function datetimeLocalToUtcIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

export function dateToDateTimeLocalInput(value: Date): string {
  return [
    value.getFullYear(),
    "-",
    pad(value.getMonth() + 1),
    "-",
    pad(value.getDate()),
    "T",
    pad(value.getHours()),
    ":",
    pad(value.getMinutes()),
  ].join("");
}

export function nowDateTimeLocalInput(): string {
  return dateToDateTimeLocalInput(new Date());
}

export function formatEventDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function isLocalDateTimeInPast(value: string): boolean {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now();
}
