import type { OpenF1 } from "../openf1/client";
import type { Driver, Lap, Meeting, Pit, RaceControl, Session, Stint } from "../openf1/types";

// A session's timing data, trimmed to what Pit Wall reads so a whole race fits in one
// Forge storage value. Rows are tuples to keep the JSON small.
export interface SessionInfo {
  key: number;
  name: string;
  type: string;
  year: number;
  meetingKey: number;
  meetingName: string;
  location: string;
  country: string;
  circuit: string;
  start: string;
}

export interface DriverInfo {
  number: number;
  code: string;
  name: string;
  team: string;
  colour: string;
}

// driver number, lap, start (ms), duration (s), sector 1, sector 2, sector 3, out-lap (1/0)
export type LapRow = [number, number, number | null, number | null, number | null, number | null, number | null, number];
// driver number, stint, compound, first lap, last lap, tyre age at start
export type StintRow = [number, number, string, number, number, number];
// driver number, lap, pit exit (ms), pit lane time (s), stationary time (s)
export type PitRow = [number, number, number, number | null, number | null];
// time (ms), flag, scope, sector, message
export type MessageRow = [number, string | null, string | null, number | null, string];

export interface CompactSession {
  info: SessionInfo;
  drivers: DriverInfo[];
  laps: LapRow[];
  stints: StintRow[];
  pits: PitRow[];
  messages: MessageRow[];
}

export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlDays: number): Promise<void>;
}

const VERSION = "v1";
const LAP_CHUNK = 1500; // rows per stored chunk, about 90 KB, under the 240 KiB value limit
const FINISHED_TTL_DAYS = 30;
const SCHEDULE_TTL_DAYS = 1;

const ms = (date: string | null) => (date ? Date.parse(date) : null);

export function compact(
  session: Session,
  meeting: Meeting | undefined,
  drivers: Driver[],
  laps: Lap[],
  stints: Stint[],
  pits: Pit[],
  messages: RaceControl[],
): CompactSession {
  const seen = new Set<number>();
  return {
    info: {
      key: session.session_key,
      name: session.session_name,
      type: session.session_type,
      year: session.year,
      meetingKey: session.meeting_key,
      meetingName: meeting?.meeting_name ?? `${session.country_name} ${session.year}`,
      location: session.location,
      country: session.country_name,
      circuit: session.circuit_short_name,
      start: session.date_start,
    },
    drivers: drivers
      .filter((d) => !seen.has(d.driver_number) && seen.add(d.driver_number))
      .map((d) => ({
        number: d.driver_number,
        code: d.name_acronym,
        name: d.full_name,
        team: d.team_name ?? "Unknown",
        colour: d.team_colour ? `#${d.team_colour}` : "#888888",
      })),
    laps: laps.map((l) => [
      l.driver_number,
      l.lap_number,
      ms(l.date_start),
      l.lap_duration,
      l.duration_sector_1,
      l.duration_sector_2,
      l.duration_sector_3,
      l.is_pit_out_lap ? 1 : 0,
    ]),
    stints: stints.map((s) => [
      s.driver_number,
      s.stint_number,
      (s.compound ?? "UNKNOWN").toUpperCase(),
      s.lap_start,
      s.lap_end,
      s.tyre_age_at_start ?? 0,
    ]),
    pits: pits.map((p) => [p.driver_number, p.lap_number, Date.parse(p.date), p.lane_duration, p.stop_duration]),
    messages: messages.map((m) => [Date.parse(m.date), m.flag, m.scope, m.sector, m.message ?? ""]),
  };
}

export async function meetings(year: number, api: OpenF1, store: Store): Promise<Meeting[]> {
  const key = `meetings:${year}:${VERSION}`;
  const cached = await store.get<Meeting[]>(key);
  if (cached) return cached;
  const found = (await api.get<Meeting>("meetings", { year })).filter(
    (m) => !/testing/i.test(m.meeting_name),
  );
  await store.set(key, found, SCHEDULE_TTL_DAYS);
  return found;
}

export async function sessions(meetingKey: number, api: OpenF1, store: Store): Promise<Session[]> {
  const key = `sessions:${meetingKey}:${VERSION}`;
  const cached = await store.get<Session[]>(key);
  if (cached) return cached;
  const found = (await api.get<Session>("sessions", { meeting_key: meetingKey })).filter(
    (s) => !s.is_cancelled,
  );
  await store.set(key, found, SCHEDULE_TTL_DAYS);
  return found;
}

// A session's data, from storage when it has been loaded before.
export async function loadSession(sessionKey: number, api: OpenF1, store: Store): Promise<CompactSession> {
  const key = `session:${sessionKey}:${VERSION}`;
  const head = await store.get<Omit<CompactSession, "laps"> & { chunks: number }>(key);
  if (head) {
    const laps: LapRow[] = [];
    for (let i = 0; i < head.chunks; i++) {
      laps.push(...((await store.get<LapRow[]>(`${key}:laps:${i}`)) ?? []));
    }
    const { chunks: _chunks, ...rest } = head;
    return { ...rest, laps };
  }

  const [session] = await api.get<Session>("sessions", { session_key: sessionKey });
  if (!session) throw new Error(`OpenF1 has no session ${sessionKey}.`);
  const [meeting] = await api.get<Meeting>("meetings", { meeting_key: session.meeting_key });
  const params = { session_key: sessionKey };
  const data = compact(
    session,
    meeting,
    await api.get<Driver>("drivers", params),
    await api.get<Lap>("laps", params),
    await api.get<Stint>("stints", params),
    await api.get<Pit>("pit", params),
    await api.get<RaceControl>("race_control", params),
  );
  if (!data.laps.length) throw new Error("OpenF1 has no laps for this session yet.");

  // Only finished sessions are kept for long; a live one is still changing.
  const finished = Date.parse(session.date_end) < Date.now() - 60 * 60 * 1000;
  const ttl = finished ? FINISHED_TTL_DAYS : 0;
  if (ttl) {
    const chunks = Math.ceil(data.laps.length / LAP_CHUNK);
    for (let i = 0; i < chunks; i++) {
      await store.set(`${key}:laps:${i}`, data.laps.slice(i * LAP_CHUNK, (i + 1) * LAP_CHUNK), ttl);
    }
    const { laps: _laps, ...rest } = data;
    await store.set(key, { ...rest, chunks }, ttl);
  }
  return data;
}
