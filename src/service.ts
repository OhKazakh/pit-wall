// What the macro's resolver and the Rovo actions share: cached debriefs and the page links.
import { buildDebrief, type Debrief } from "./calc/debrief";
import { openf1, store } from "./data/kvs";
import { type CompactSession, loadSession } from "./data/session";

const VERSION = "v2";
const DEBRIEF_TTL_DAYS = 30;

export interface PageLink {
  sessionKey: number;
  projectKey: string;
  pageUrl: string;
}

export const session = (sessionKey: number): Promise<CompactSession> => loadSession(sessionKey, openf1(), store);

export async function debrief(sessionKey: number): Promise<Debrief> {
  const key = `debrief:${sessionKey}:${VERSION}`;
  const cached = await store.get<Debrief>(key);
  if (cached) return cached;
  const built = buildDebrief(await session(sessionKey));
  const finished = Date.parse(built.session.start) < Date.now() - 4 * 60 * 60 * 1000;
  if (finished) await store.set(key, built, DEBRIEF_TTL_DAYS);
  return built;
}

// The macro records which session a page debriefs, so the agent can answer "this page".
export const linkPage = (contentId: string, link: PageLink) => store.set(`page:${contentId}`, link, 0);
export const pageLink = (contentId: string) => store.get<PageLink>(`page:${contentId}`);

export const issueKey = (sessionKey: number, findingId: string) =>
  store.get<{ key: string; url: string }>(`issue:${sessionKey}:${findingId}`);
export const rememberIssue = (sessionKey: number, findingId: string, issue: { key: string; url: string }) =>
  store.set(`issue:${sessionKey}:${findingId}`, issue, 0);
