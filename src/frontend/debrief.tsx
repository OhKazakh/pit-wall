import ForgeReconciler, {
  BarChart,
  Box,
  Button,
  DynamicTable,
  EmptyState,
  Heading,
  Inline,
  LineChart,
  Link,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  useConfig,
  useProductContext,
  xcss,
} from "@forge/react";
import React, { useEffect, useState } from "react";
import { call } from "./call";
import type { Debrief } from "../calc/debrief";
import type { Finding } from "../calc/findings";

type Issue = { key: string; url: string };

const card = xcss({
  backgroundColor: "color.background.neutral",
  borderRadius: "radius.medium",
  padding: "space.200",
});

const lapTime = (s: number | null) => {
  if (s === null) return "";
  const minutes = Math.floor(s / 60);
  return minutes ? `${minutes}:${(s - minutes * 60).toFixed(3).padStart(6, "0")}` : s.toFixed(3);
};

const FindingCard = ({
  finding,
  issue,
  canFile,
  onFile,
}: {
  finding: Finding;
  issue?: Issue;
  canFile: boolean;
  onFile: () => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Box xcss={card}>
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center">
          <Lozenge appearance={finding.kind === "slow-stop" ? "moved" : "removed"}>
            {finding.kind === "slow-stop" ? "Pit stop" : "Tyre wear"}
          </Lozenge>
          <Text weight="bold">{finding.title}</Text>
        </Inline>
        <Text>{finding.detail}</Text>
        {issue ? (
          <Text>
            Filed as <Link href={issue.url}>{issue.key}</Link>
          </Text>
        ) : canFile ? (
          <Inline>
            <Button
              isDisabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await onFile();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Creating issue..." : "Create Jira issue"}
            </Button>
          </Inline>
        ) : null}
        {error ? <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage> : null}
      </Stack>
    </Box>
  );
};

const App = () => {
  const config = useConfig() as Record<string, string> | undefined;
  const context = useProductContext();
  const [data, setData] = useState<Debrief | null>(null);
  const [issues, setIssues] = useState<Record<string, Issue>>({});
  const [error, setError] = useState("");

  const siteUrl = context?.siteUrl ?? "";
  const contentId = (context?.extension as { content?: { id?: string } } | undefined)?.content?.id;
  const pageUrl = siteUrl && contentId ? `${siteUrl}/wiki/pages/viewpage.action?pageId=${contentId}` : "";
  const sessionKey = config?.sessionKey;
  const projectKey = config?.projectKey ?? "";

  useEffect(() => {
    if (!sessionKey || !context) return;
    setData(null);
    setError("");
    call<{ debrief: Debrief; issues: Record<string, Issue> }>("debrief", { sessionKey, projectKey, pageUrl })
      .then((reply) => {
        setData(reply.debrief);
        setIssues(reply.issues);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [sessionKey, projectKey, pageUrl, Boolean(context)]);

  if (!sessionKey) {
    return (
      <EmptyState
        header="Choose a session to debrief"
        description="Edit this macro and pick a season, a Grand Prix and a session."
      />
    );
  }
  if (error) {
    return (
      <SectionMessage appearance="error" title="Couldn't load the session">
        <Text>{error}</Text>
      </SectionMessage>
    );
  }
  if (!data) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner />
        <Text>Loading timing data. The first load of a session takes a few seconds.</Text>
      </Inline>
    );
  }

  const race = data.session.type === "Race";
  const top = data.drivers.slice(0, 5).map((d) => d.driver);
  const fastest = [...data.drivers].filter((d) => d.bestLap !== null).sort((a, b) => (a.bestLap as number) - (b.bestLap as number))[0];
  const file = async (finding: Finding) => {
    const issue = await call<Issue>("createIssue", {
      sessionKey,
      findingId: finding.id,
      projectKey,
      pageUrl,
      siteUrl,
    });
    setIssues((current) => ({ ...current, [finding.id]: issue }));
  };

  return (
    <Stack space="space.200">
      <Stack space="space.050">
        <Heading size="medium">
          {data.session.year} {data.session.meetingName}, {data.session.name}
        </Heading>
        <Text>
          {race ? `${data.totalLaps} laps, ${data.neutralisedLaps} under a safety car or VSC. ` : ""}
          {race && data.drivers[0]?.position === 1
            ? `${data.drivers[0].name} first on the road, ahead of ${data.drivers.slice(1, 3).map((d) => d.driver).join(" and ")}. `
            : ""}
          {fastest ? `Fastest clean lap: ${fastest.driver}, ${lapTime(fastest.bestLap)}.` : ""}
        </Text>
      </Stack>

      <Tabs id="debrief">
        <TabList>
          <Tab>Findings ({data.findings.length})</Tab>
          <Tab>Lap times</Tab>
          <Tab>Tyre wear</Tab>
          {race ? <Tab>Pit stops</Tab> : null}
          {race ? <Tab>Gaps</Tab> : null}
        </TabList>

        <TabPanel>
          <Stack space="space.150">
            {data.findings.length ? (
              data.findings.map((f) => (
                <FindingCard key={f.id} finding={f} issue={issues[f.id]} canFile={Boolean(projectKey)} onFile={() => file(f)} />
              ))
            ) : (
              <Text>Nothing stood out: no stop 1.5 s over its median and no stint wearing well above its compound.</Text>
            )}
            {!projectKey && data.findings.length ? (
              <Text>Pick a Jira project in this macro's settings to file findings as issues.</Text>
            ) : null}
          </Stack>
        </TabPanel>

        <TabPanel>
          <LineChart
            data={data.lapTimes.filter((l) => top.includes(l.driver))}
            xAccessor="lap"
            yAccessor="time"
            colorAccessor="driver"
            title={`Clean laps, ${race ? "top 5 at the flag" : "5 quickest"} (seconds)`}
            subtitle="In-laps, out-laps, safety car laps and laps over 7% off the fastest are left out"
            height={360}
          />
        </TabPanel>

        <TabPanel>
          <Stack space="space.200">
            <BarChart
              data={data.stints.filter((s) => s.wear !== null).map((s) => ({ stint: `${s.driver} ${s.stint}`, wear: s.wear, compound: s.compound }))}
              xAccessor="stint"
              yAccessor="wear"
              colorAccessor="compound"
              title="Wear per stint (seconds lost per lap of tyre age)"
              subtitle={race ? "Fuel-corrected by 0.055 s per lap of fuel. Stints with at least 8 clean laps." : "Stints with at least 8 clean laps."}
              height={320}
            />
            <DynamicTable
              head={{
                cells: ["Driver", "Stint", "Compound", "Laps", "Clean laps", "Wear (s/lap)", "Median lap"].map((label) => ({
                  key: label,
                  content: label,
                })),
              }}
              rows={data.stints.map((s) => ({
                key: `${s.driver}-${s.stint}`,
                cells: [
                  s.driver,
                  String(s.stint),
                  s.compound.toLowerCase(),
                  `${s.firstLap} to ${s.lastLap}`,
                  String(s.cleanLaps),
                  s.wear === null ? "" : s.wear.toFixed(3),
                  lapTime(s.pace),
                ].map((content, i) => ({ key: String(i), content })),
              }))}
              rowsPerPage={20}
            />
          </Stack>
        </TabPanel>

        {race ? (
          <TabPanel>
            <Stack space="space.200">
              <BarChart
                data={data.stops.map((s) => ({ stop: `${s.driver} L${s.lap}`, seconds: s.value, verdict: s.slow ? "1.5 s or more over" : "Within 1.5 s" }))}
                xAccessor="stop"
                yAccessor="seconds"
                colorAccessor="verdict"
                title={`Pit stops, ${data.stops[0]?.measure === "lane" ? "pit lane time" : "stationary time"} (seconds)`}
                subtitle="Served time penalties taken out"
                height={320}
              />
              <DynamicTable
                head={{
                  cells: ["Driver", "Lap", "Time", "Median", "Compared with", "Over by", "Penalty served"].map((label) => ({
                    key: label,
                    content: label,
                  })),
                }}
                rows={data.stops.map((s) => ({
                  key: `${s.driver}-${s.lap}`,
                  isHighlighted: s.slow,
                  cells: [
                    s.driver,
                    String(s.lap),
                    s.value.toFixed(1),
                    s.median.toFixed(1),
                    s.comparedWith === "team" ? `${s.team} median` : "session median",
                    (s.delta >= 0 ? "+" : "") + s.delta.toFixed(1),
                    s.penalty ? `${s.penalty} s` : "",
                  ].map((content, i) => ({ key: String(i), content })),
                }))}
              />
            </Stack>
          </TabPanel>
        ) : null}

        {race ? (
          <TabPanel>
            <LineChart
              data={data.gaps.filter((g) => top.includes(g.driver))}
              xAccessor="lap"
              yAccessor="gap"
              colorAccessor="driver"
              title="Gap to the leader at the line (seconds), top 5 at the flag"
              height={360}
            />
          </TabPanel>
        ) : null}
      </Tabs>

      <Text>
        Public timing data from OpenF1. A team would plug in its own telemetry. Pit Wall is unofficial and not associated
        with Formula 1 or any team.
      </Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
