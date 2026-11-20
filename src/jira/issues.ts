import { asUser, route } from "@forge/api";
import type { Finding } from "../calc/findings";
import type { SessionInfo } from "../data/session";

const LABELS: Record<string, string> = {
  stint: "Stint",
  compound: "Compound",
  firstLap: "First lap",
  lastLap: "Last lap",
  wear: "Wear (s per lap of tyre age)",
  compoundMedian: "Median wear on this compound (s per lap)",
  excess: "Above the median by (s per lap)",
  cleanLaps: "Clean laps in the fit",
  lap: "Lap",
  measure: "Measured",
  value: "Time (s)",
  median: "Median it is compared with (s)",
  comparedWith: "Compared with",
  delta: "Slower by (s)",
  lane: "Pit lane time (s)",
  penaltyServed: "Time penalty served and taken out (s)",
};

const text = (value: string, href?: string) => ({
  type: "text",
  text: value,
  ...(href ? { marks: [{ type: "link", attrs: { href } }] } : {}),
});
const paragraph = (...content: object[]) => ({ type: "paragraph", content });

// The issue body in Atlassian Document Format: what was found, the numbers, and the way back.
export function description(finding: Finding, session: SessionInfo, pageUrl: string) {
  return {
    version: 1,
    type: "doc",
    content: [
      paragraph(text(`${session.year} ${session.meetingName}, ${session.name}. ${finding.detail}`)),
      {
        type: "bulletList",
        content: Object.entries(finding.numbers).map(([key, value]) => ({
          type: "listItem",
          content: [paragraph(text(`${LABELS[key] ?? key}: ${value}`))],
        })),
      },
      paragraph(text("Debrief page: "), text(pageUrl || "not linked", pageUrl || undefined)),
      paragraph(
        text("Made by Pit Wall from public timing data (OpenF1). A team would run it on its own telemetry."),
      ),
    ],
  };
}

interface IssueType {
  id: string;
  name: string;
  subtask?: boolean;
}

async function issueType(projectKey: string): Promise<string> {
  const reply = await asUser().requestJira(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`, {
    headers: { Accept: "application/json" },
  });
  if (!reply.ok) throw new Error(`Jira didn't list the issue types for ${projectKey} (${reply.status}).`);
  const body = (await reply.json()) as { issueTypes?: IssueType[]; values?: IssueType[] };
  const types = (body.issueTypes ?? body.values ?? []).filter((t) => !t.subtask);
  const task = types.find((t) => t.name === "Task") ?? types[0];
  if (!task) throw new Error(`${projectKey} has no issue type Pit Wall can use.`);
  return task.id;
}

// Created as the person who asked, so Jira's own permissions apply.
export async function createIssue(
  finding: Finding,
  session: SessionInfo,
  projectKey: string,
  pageUrl: string,
  siteUrl: string,
): Promise<{ key: string; url: string }> {
  const fields = {
    project: { key: projectKey },
    issuetype: { id: await issueType(projectKey) },
    summary: `[Pit Wall] ${finding.title}`.slice(0, 250),
    description: description(finding, session, pageUrl),
    labels: ["pit-wall"],
  };
  const post = (body: object) =>
    asUser().requestJira(route`/rest/api/3/issue`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  let reply = await post({ fields });
  // Some projects keep labels off the create screen; the issue matters more than the label.
  if (reply.status === 400) {
    const { labels: _labels, ...rest } = fields;
    reply = await post({ fields: rest });
  }
  if (!reply.ok) throw new Error(`Jira refused the issue (${reply.status}): ${await reply.text()}`);
  const { key } = (await reply.json()) as { key: string };
  return { key, url: `${siteUrl.replace(/\/$/, "")}/browse/${key}` };
}

export async function projects(): Promise<{ key: string; name: string }[]> {
  const reply = await asUser().requestJira(route`/rest/api/3/project/search?maxResults=50&orderBy=name`, {
    headers: { Accept: "application/json" },
  });
  if (!reply.ok) return [];
  const body = (await reply.json()) as { values: { key: string; name: string }[] };
  return body.values.map(({ key, name }) => ({ key, name }));
}
