import { view } from "@forge/bridge";
import ForgeReconciler, {
  Button,
  Heading,
  Label,
  SectionMessage,
  Select,
  Stack,
  Text,
  useProductContext,
} from "@forge/react";
import React, { useEffect, useState } from "react";
import { call } from "./call";

interface Option {
  label: string;
  value: string;
}

// OpenF1 has timing data from the 2023 season on.
const FIRST_SEASON = 2023;
const seasons: Option[] = Array.from({ length: new Date().getFullYear() - FIRST_SEASON + 1 }, (_, i) => {
  const year = String(new Date().getFullYear() - i);
  return { label: year, value: year };
});

const Config = () => {
  const context = useProductContext();
  const saved = (context?.extension?.config ?? {}) as Record<string, string>;
  const [year, setYear] = useState<Option>(seasons[0]);
  const [races, setRaces] = useState<Option[]>([]);
  const [race, setRace] = useState<Option | null>(null);
  const [sessions, setSessions] = useState<Option[]>([]);
  const [session, setSession] = useState<Option | null>(null);
  const [projects, setProjects] = useState<Option[]>([]);
  const [project, setProject] = useState<Option | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (saved.year) setYear({ label: saved.year, value: saved.year });
    if (saved.projectKey) setProject({ label: saved.projectKey, value: saved.projectKey });
  }, [saved.year, saved.projectKey]);

  useEffect(() => {
    call<{ key: string; name: string }[]>("projects")
      .then((found) => {
        const options = found.map((p) => ({ label: `${p.name} (${p.key})`, value: p.key }));
        setProjects(options);
        const current = options.find((o) => o.value === saved.projectKey);
        if (current) setProject(current);
      })
      .catch(() => setProjects([]));
  }, [saved.projectKey]);

  useEffect(() => {
    setRace(null);
    setSessions([]);
    call<{ key: number; name: string }[]>("meetings", { year: year.value })
      .then((found) => {
        const options = found.map((m) => ({ label: m.name, value: String(m.key) }));
        setRaces(options);
        if (saved.meetingKey) setRace(options.find((o) => o.value === saved.meetingKey) ?? null);
      })
      .catch((e) => setError(String(e)));
  }, [year.value]);

  useEffect(() => {
    setSession(null);
    if (!race) return;
    call<{ key: number; name: string }[]>("sessions", { meetingKey: race.value })
      .then((found) => {
        const options = found.map((s) => ({ label: s.name, value: String(s.key) }));
        setSessions(options);
        setSession(
          options.find((o) => o.value === saved.sessionKey) ?? options.find((o) => o.label === "Race") ?? null,
        );
      })
      .catch((e) => setError(String(e)));
  }, [race?.value]);

  const save = () =>
    view.submit({
      config: {
        year: year.value,
        meetingKey: race?.value ?? "",
        sessionKey: session?.value ?? "",
        title: race && session ? `${year.value} ${race.label}, ${session.label}` : "",
        projectKey: project?.value ?? "",
      },
    });

  return (
    <Stack space="space.200">
      <Heading size="small">Which session should this page debrief?</Heading>
      {error ? <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage> : null}
      <Stack space="space.050">
        <Label labelFor="season">Season</Label>
        <Select inputId="season" options={seasons} value={year} onChange={(o: Option) => setYear(o)} />
      </Stack>
      <Stack space="space.050">
        <Label labelFor="race">Grand Prix</Label>
        <Select inputId="race" options={races} value={race} onChange={(o: Option) => setRace(o)} isLoading={!races.length} />
      </Stack>
      <Stack space="space.050">
        <Label labelFor="session">Session</Label>
        <Select inputId="session" options={sessions} value={session} onChange={(o: Option) => setSession(o)} isDisabled={!race} />
      </Stack>
      <Stack space="space.050">
        <Label labelFor="project">Jira project for findings (optional)</Label>
        <Select
          inputId="project"
          options={projects}
          value={project}
          onChange={(o: Option | null) => setProject(o)}
          isClearable
          placeholder={projects.length ? "Choose a project" : "No Jira projects found"}
        />
      </Stack>
      <Text>Timing data comes from OpenF1, a free public API. A team would connect its own telemetry instead.</Text>
      <Button appearance="primary" onClick={save} isDisabled={!session}>
        Save
      </Button>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <Config />
  </React.StrictMode>,
);
