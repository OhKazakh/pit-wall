// What the browser or the agent sends can be edited by whoever sends it. These checks keep
// stored links on the site's own address and numbers in range.

const ATLASSIAN_SITE = /^https:\/\/[a-z0-9][a-z0-9-]*\.atlassian\.net$/;
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,9}$/;
const PAGE_ID = /^\d+$/;

// Forge's own context comes first. A claimed address is used only if it looks like an Atlassian site.
export function siteOrigin(fromContext: unknown, claimed?: unknown): string {
  for (const value of [fromContext, claimed]) {
    if (typeof value !== "string") continue;
    const origin = value.replace(/\/+$/, "");
    if (ATLASSIAN_SITE.test(origin)) return origin;
  }
  return "";
}

export function pageAddress(site: string, contentId: unknown): string {
  const id = String(contentId ?? "");
  return site && PAGE_ID.test(id) ? `${site}/wiki/pages/viewpage.action?pageId=${id}` : "";
}

export function projectKey(value: unknown): string {
  const key = typeof value === "string" ? value.trim().toUpperCase() : "";
  return PROJECT_KEY.test(key) ? key : "";
}

export function positiveInt(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a whole number above 0.`);
  return n;
}
