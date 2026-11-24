import Resolver from "@forge/resolver";
import { stintDetail } from "./calc/debrief";
import { reviewStops, pitStops as allStops } from "./calc/pits";
import { lapTable } from "./calc/laps";
import { rejoin } from "./calc/rejoin";
import { meetings, sessions } from "./data/session";
import { openf1, store } from "./data/kvs";
import { createIssue, projects } from "./jira/issues";
import { debrief, issueKey, linkPage, pageLink, rememberIssue, session } from "./service";
import { pageAddress, positiveInt, projectKey as checkedKey, siteOrigin } from "./trust";

const resolver = new Resolver();
const now = () => Date.now();

resolver.define("meetings", async ({ payload }) => {
  const found = await meetings(Number(payload.year), openf1(), store);
  return found
    .filter((m) => Date.parse(m.date_start) < now())
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))
    .map((m) => ({ key: m.meeting_key, name: m.meeting_name, location: m.location }));
});

resolver.define("sessions", async ({ payload }) => {
  const found = await sessions(Number(payload.meetingKey), openf1(), store);
  return found
    .filter((s) => Date.parse(s.date_end) < now())
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))
    .map((s) => ({ key: s.session_key, name: s.session_name }));
});

resolver.define("projects", () => projects());

// The macro's saved settings come from Forge's context, not from the browser, so a viewer
// can't point a page at another session or another project.
interface MacroContext {
  siteUrl?: string;
  extension?: { content?: { id?: string }; config?: { sessionKey?: string; projectKey?: string } };
}

function macroSettings(context: MacroContext, payload: Record<string, unknown>) {
  const config = context.extension?.config;
  const site = siteOrigin(context.siteUrl, payload.siteUrl);
  const contentId = context.extension?.content?.id;
  return {
    sessionKey: positiveInt(config?.sessionKey ?? payload.sessionKey, "sessionKey"),
    projectKey: checkedKey(config ? config.projectKey : payload.projectKey),
    contentId: contentId ? String(contentId) : "",
    site,
    pageUrl: pageAddress(site, contentId),
  };
}

resolver.define("debrief", async ({ payload, context }) => {
  const { sessionKey, projectKey, contentId, pageUrl } = macroSettings(context, payload);
  const built = await debrief(sessionKey);
  if (contentId) await linkPage(contentId, { sessionKey, projectKey, pageUrl });
  const issues: Record<string, { key: string; url: string }> = {};
  for (const finding of built.findings) {
    const issue = await issueKey(sessionKey, finding.id);
    if (issue) issues[finding.id] = issue;
  }
  return { debrief: built, issues };
});

resolver.define("createIssue", async ({ payload, context }) => {
  const { sessionKey, projectKey, site, pageUrl } = macroSettings(context, payload);
  if (!projectKey) throw new Error("Pick a Jira project in this macro's settings first.");
  const findingId = String(payload.findingId ?? "");
  const existing = await issueKey(sessionKey, findingId);
  if (existing) return existing;
  const built = await debrief(sessionKey);
  const finding = built.findings.find((f) => f.id === findingId);
  if (!finding) throw new Error("That finding is no longer in the debrief.");
  const issue = await createIssue(finding, built.session, projectKey, pageUrl, site);
  await rememberIssue(sessionKey, finding.id, issue);
  return issue;
});

export const handler = resolver.getDefinitions();

// Rovo actions. Each returns plain numbers with units, so the agent has nothing to make up.

interface ActionPayload {
  sessionKey?: number;
  year?: number;
  race?: string;
  session?: string;
  driver?: string;
  stint?: number;
  lap?: number;
  findingId?: string;
  projectKey?: string;
  context?: { confluence?: { contentId?: string } };
}

async function sessionFor(payload: ActionPayload): Promise<number> {
  if (payload.sessionKey) return positiveInt(payload.sessionKey, "sessionKey");
  const contentId = payload.context?.confluence?.contentId;
  const link = contentId ? await pageLink(String(contentId)) : undefined;
  if (link) return link.sessionKey;
  throw new Error(
    "No session given and this page has no Session debrief. Ask with a season, race and session, for example 2025 Monza race.",
  );
}

// Only the action's own inputs are logged. The payload also carries a signed context token,
// which must never end up in logs.
const INPUTS = ["year", "race", "session", "sessionKey", "driver", "stint", "lap", "findingId", "projectKey"] as const;
function logCall(action: string, payload: ActionPayload) {
  const inputs = Object.fromEntries(INPUTS.filter((k) => payload[k] !== undefined).map((k) => [k, payload[k]]));
  console.log(`${action} ${JSON.stringify(inputs)}`);
}

const fail = (action: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${action} failed: ${message}`);
  return { error: message };
};

async function driverCode(sessionKey: number, driver: string): Promise<string> {
  const { drivers } = await session(sessionKey);
  const wanted = driver.trim().toUpperCase();
  const found = drivers.find(
    (d) => String(d.number) === wanted || d.code === wanted || d.name.toUpperCase().split(" ").includes(wanted),
  );
  if (!found) throw new Error(`No driver "${driver}" in this session. Drivers: ${drivers.map((d) => `${d.code} (${d.number})`).join(", ")}.`);
  return found.code;
}

export async function findSession(payload: ActionPayload) {
  logCall("findSession", payload);
  try {
    const year = Number(payload.year);
    const race = (payload.race ?? "").toLowerCase();
    const found = (await meetings(year, openf1(), store)).filter((m) =>
      [m.meeting_name, m.location, m.country_name].some((field) => field.toLowerCase().includes(race)),
    );
    if (!found.length) return { error: `No ${year} race matches "${payload.race}".` };
    const meeting = found[0];
    const all = await sessions(meeting.meeting_key, openf1(), store);
    const name = (payload.session ?? "Race").toLowerCase();
    const match = all.find((s) => s.session_name.toLowerCase() === name) ?? all.find((s) => s.session_name.toLowerCase().includes(name));
    return {
      race: `${year} ${meeting.meeting_name}`,
      sessionKey: match?.session_key ?? null,
      session: match?.session_name ?? null,
      sessions: all.map((s) => ({ sessionKey: s.session_key, name: s.session_name })),
    };
  } catch (error) {
    return fail("findSession", error);
  }
}

export async function sessionSummary(payload: ActionPayload) {
  logCall("sessionSummary", payload);
  try {
    const d = await debrief(await sessionFor(payload));
    return {
      session: `${d.session.year} ${d.session.meetingName}, ${d.session.name}`,
      sessionKey: d.session.key,
      laps: d.totalLaps,
      lapsUnderSafetyCarOrVsc: d.neutralisedLaps,
      orderAtTheFlag: d.drivers.map((x) => ({
        position: x.position,
        driver: x.driver,
        car: x.name,
        team: x.team,
        bestLapSeconds: x.bestLap,
        stops: x.stops,
      })),
      findings: d.findings.map(({ id, title, detail, numbers }) => ({ id, title, detail, numbers })),
      note: "Order on track at the flag, before penalties. Public OpenF1 timing data.",
    };
  } catch (error) {
    return fail("sessionSummary", error);
  }
}

export async function stintAnalysis(payload: ActionPayload) {
  logCall("stintAnalysis", payload);
  try {
    const sessionKey = await sessionFor(payload);
    const code = await driverCode(sessionKey, String(payload.driver ?? ""));
    const data = await session(sessionKey);
    const stints = (await debrief(sessionKey)).stints.filter((s) => s.driver === code);
    if (payload.stint !== undefined && payload.stint !== null && String(payload.stint) !== "") positiveInt(payload.stint, "stint");
    if (!payload.stint) {
      return { driver: code, stints, hint: "Ask about one stint number for its laps and gaps." };
    }
    const detail = stintDetail(data, code, Number(payload.stint));
    if (!detail) return { error: `${code} has no stint ${payload.stint}. Stints: ${stints.map((s) => s.stint).join(", ")}.` };
    return {
      driver: code,
      ...detail,
      units: "Times in seconds. Wear is seconds lost per lap of tyre age, fuel-corrected by 0.055 s per lap of fuel.",
    };
  } catch (error) {
    return fail("stintAnalysis", error);
  }
}

export async function pitStops(payload: ActionPayload) {
  logCall("pitStops", payload);
  try {
    const sessionKey = await sessionFor(payload);
    const reviews = reviewStops(allStops(await session(sessionKey)));
    const code = payload.driver ? await driverCode(sessionKey, String(payload.driver)) : null;
    return {
      stops: reviews.filter((r) => !code || r.driver === code),
      rule: "A stop is slow when it is at least 1.5 s over its team's median, or the session median for teams with fewer than 3 stops. Served time penalties are taken out.",
    };
  } catch (error) {
    return fail("pitStops", error);
  }
}

export async function pitRejoin(payload: ActionPayload) {
  logCall("pitRejoin", payload);
  try {
    const sessionKey = await sessionFor(payload);
    const lap = positiveInt(payload.lap, "lap");
    const code = await driverCode(sessionKey, String(payload.driver ?? ""));
    const data = await session(sessionKey);
    const result = rejoin(lapTable(data), code, lap);
    if (!result) return { error: `${code} has no timed lap ${lap} in this session, or no stop to measure a pit loss from.` };
    return {
      ...result,
      units: "Times in seconds. Gaps are to the leader at the line.",
      method:
        "Pit loss is the median, over this session's stops, of in-lap plus out-lap minus two laps at the car's own pace before the stop. The estimate assumes the other cars keep their gaps.",
    };
  } catch (error) {
    return fail("pitRejoin", error);
  }
}

export async function createFinding(payload: ActionPayload) {
  logCall("createFinding", payload);
  try {
    const sessionKey = await sessionFor(payload);
    const contentId = payload.context?.confluence?.contentId;
    const link = contentId ? await pageLink(String(contentId)) : undefined;
    const projectKey = checkedKey(payload.projectKey) || link?.projectKey;
    if (!projectKey) return { error: "Which Jira project should the issue go in? Give its key, for example PW." };
    const existing = await issueKey(sessionKey, String(payload.findingId));
    if (existing) return { created: false, issue: existing, note: "An issue for this finding already exists." };
    const built = await debrief(sessionKey);
    const finding = built.findings.find((f) => f.id === payload.findingId);
    if (!finding) return { error: `No finding ${payload.findingId}. Findings: ${built.findings.map((f) => f.id).join(", ") || "none"}.` };
    const pageUrl = link?.pageUrl ?? "";
    const siteUrl = siteOrigin(pageUrl ? new URL(pageUrl).origin : "");
    const issue = await createIssue(finding, built.session, projectKey, pageUrl, siteUrl);
    await rememberIssue(sessionKey, finding.id, issue);
    return { created: true, issue };
  } catch (error) {
    return fail("createFinding", error);
  }
}
