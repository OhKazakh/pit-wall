import type { MessageRow } from "../data/session";

// Track status codes, as in the official timing feed and FastF1.
export const GREEN = "1";
export const YELLOW = "2";
export const SAFETY_CAR = "4";
export const RED = "5";
export const VSC = "6";
export const VSC_ENDING = "7";

// Race control doesn't announce the end of a VSC, so the ending phase gets a typical length.
const VSC_ENDING_MS = 15_000;

export interface StatusChange {
  at: number;
  status: string;
}

// The track status rebuilt from race control messages: one change per entry.
export function statusChanges(messages: MessageRow[]): StatusChange[] {
  type Event = [number, string, string | null, string | null, number | null];
  const events: Event[] = messages.map(([at, flag, scope, sector, message]) => [
    at,
    message.toUpperCase(),
    flag,
    scope,
    sector,
  ]);
  for (const [at, message] of [...events]) {
    if (message.includes("SAFETY CAR ENDING") || message.startsWith("VSC ENDING")) {
      events.push([at + VSC_ENDING_MS, "VSC ENDED", null, null, null]);
    }
  }
  events.sort((a, b) => a[0] - b[0]);

  const yellow = new Set<string>();
  let safetyCar = false;
  let virtual = false;
  let ending = false;
  let red = false;
  const changes: StatusChange[] = [];
  for (const [at, message, flag, scope, sector] of events) {
    if (message.includes("VIRTUAL SAFETY CAR DEPLOYED") || message.startsWith("VSC DEPLOYED")) {
      virtual = true;
      ending = false;
    } else if (message.includes("SAFETY CAR ENDING") || message.startsWith("VSC ENDING")) {
      virtual = false;
      ending = true;
    } else if (message === "VSC ENDED") {
      ending = false;
    } else if (message.startsWith("SAFETY CAR DEPLOYED")) {
      safetyCar = true;
      virtual = false;
      ending = false;
    } else if (flag === "RED") {
      red = true;
    } else if (flag === "CLEAR" && scope === "Track") {
      safetyCar = virtual = ending = red = false;
      yellow.clear();
    } else if (flag === "GREEN" && scope === "Track") {
      red = false;
    } else if (flag === "YELLOW" || flag === "DOUBLE YELLOW") {
      yellow.add(scope === "Sector" ? String(sector) : "track");
    } else if (flag === "CLEAR" && scope === "Sector") {
      yellow.delete(String(sector));
    }
    const status = red
      ? RED
      : safetyCar
        ? SAFETY_CAR
        : virtual
          ? VSC
          : ending
            ? VSC_ENDING
            : yellow.size
              ? YELLOW
              : GREEN;
    if (status !== changes.at(-1)?.status) changes.push({ at, status });
  }
  return changes;
}

// Every status seen from a lap's start to its end, as one string of codes.
export function lapStatus(start: number | null, end: number | null, changes: StatusChange[]): string {
  if (start === null || !changes.length) return GREEN;
  const before = changes.filter((c) => c.at <= start);
  const seen = [before.length ? before[before.length - 1].status : GREEN];
  if (end !== null) {
    for (const c of changes) {
      if (c.at > start && c.at < end && !seen.includes(c.status)) seen.push(c.status);
    }
  }
  return seen.join("");
}

export const isNeutralised = (status: string) => /[4567]/.test(status);
