# Pit Wall

Pit Wall turns a race session's timing data into a debrief in Confluence, a Rovo agent that answers questions about it, and Jira issues for what needs a look. It is an Atlassian Forge app.

The demo uses public Formula 1 timing data from [OpenF1](https://openf1.org). A real team would plug in its own telemetry instead. Pit Wall is unofficial and not associated with Formula 1 or any team.

## What it does

**Session debrief (Confluence macro).** Add it to a page, pick a season, a Grand Prix and a session, and optionally a Jira project. The macro shows:

- the session in one line: laps, laps under a safety car or VSC, the top 3 on the road and the fastest clean lap
- **Findings**: stops and stints that stand out, each with its numbers and a "Create Jira issue" button
- **Lap times**: clean laps of the top 5 at the flag (the 5 quickest outside a race), lap by lap
- **Tyre wear**: wear per stint as a chart and a table with each stint's laps, clean laps, wear and median lap
- **Pit stops** (races): every stop against the median it's compared with, served penalties taken out
- **Gaps** (races): the top 5's gap to the leader, lap by lap

**Race engineer (Rovo agent).** Ask it about the session on the page, or about any session from 2023 on. It has six actions, and its prompt tells it to state only numbers those actions returned. Rovo's debug view lists which actions it called for each answer.

| Action | What it returns |
| --- | --- |
| Find session | A session's key from a season, a Grand Prix, country or circuit, and a session name |
| Session summary | The order at the flag, best laps, stop counts and every finding with its numbers |
| Stint analysis | One driver's stints, or one stint lap by lap with a note on each lap that isn't clean, plus its wear against the compound's median, its pace against the field on the same compound, and its gap to the leader at the start and end |
| Pit stops | Every stop with its time, the median it's compared with and how far over it was |
| Pit rejoin | Where a driver would have come back on track had they pitted at the end of a given lap: the position, the cars just ahead and behind with their gaps, and the pit loss used. If the driver really stopped on that lap, what happened |
| Create finding issue | A Jira issue for one finding. Rovo asks you to confirm before it runs |

Without a debrief on the page, the agent finds the session from what you name, for example "2024 Silverstone race".

**Jira findings.** An issue from the button or the agent gets the finding as its summary, the numbers as a list, a link back to the debrief page and the label `pit-wall`. It's created as the person who asked, so Jira's own permissions apply. Pit Wall remembers which findings are filed, so the page shows "Filed as PW-1" and neither the button nor the agent files the same finding twice.

## Using it

1. Install Pit Wall on a site with Confluence and Jira. Rovo is needed for the agent only, and free plans don't include it. If the install dialog says "Installation failed" for one of the two products, click Install again. Atlassian installs both at once, and on my test sites the second one needed a retry.
2. Edit a Confluence page, click **+** (Insert elements) in the toolbar and search for **Session debrief**. Choose the session and, for findings, a Jira project. Publish the page.
3. The first load of a session makes seven requests to OpenF1 and takes a few seconds. After that the session is read from storage.
4. Open Rovo chat on the page, choose **Race engineer** from the agent list and ask, for example, "Which pit stops were slow, and by how much?"

## How the numbers are worked out

All the maths lives in [`src/calc`](src/calc) and is covered by tests in [`test`](test), including a run on the 2025 Italian Grand Prix as OpenF1 served it.

**Clean laps.** A lap counts as clean when it has a time, its three sectors add up to it within 0.1 s, it isn't an in-lap or out-lap, it isn't a race's opening lap, and no safety car, virtual safety car or red flag was out at any point during it. The track status comes from race control's messages, the same way FastF1 builds it. On top of that, laps more than 7% slower than the session's fastest clean lap are left out as traffic or incidents.

**Fuel correction.** A car gets lighter as it burns fuel. Each race lap is corrected by 0.055 s for every lap of fuel still on board: `corrected = lap time - 0.055 × (race laps - lap number)`. 0.055 s is the usual public estimate; a team would use its own.

**Tyre wear.** For each stint with at least 8 clean laps, Pit Wall fits a straight line through the fuel-corrected lap times against tyre age (least squares). The slope is the wear: seconds lost per lap of tyre age. A straight line averages out the tyre warming up at the start of a stint and dropping off at the end.

**High wear.** A stint is a finding when its wear is at least 0.05 s per lap above the median of all stints on the same compound in that session, and at least half again that median. The compound needs at least 3 stints with a wear figure to compare against.

**Pit stops.** OpenF1 gives each visit's pit lane time and, in recent seasons, the time the car stood still. Pit Wall uses the stationary time where it exists, because that is the crew's part of the stop, and pit lane time otherwise. A time penalty served at the stop is taken out, matched from race control's "penalty served" message within 5 minutes of the car leaving. Visits over 60 s in the pit lane are red-flag stops or repairs and are left out.

**Slow stops.** A stop is a finding when it is at least 1.5 s slower than its team's median stop in that session. A team needs at least 3 stops for its own median; below that, the session's median is used.

**Pit loss and rejoin.** A stop costs more than its pit lane time: the car also slows to enter and builds speed on the way out. Pit Wall measures each stop as the in-lap plus the out-lap, less two laps at the car's own pace (the median of its clean laps over the 5 laps before). The session's pit loss is the median of those, kept apart for green-flag stops and stops under a safety car or VSC. At Monza in 2025 the green-flag loss was 24.7 s over 19 stops. To place a car that pits at the end of a lap, its gap to the leader at that lap plus the pit loss is set among everyone else's gaps on the same lap. That assumes the others keep their gaps for the lap it takes, the usual pit-window estimate. For NOR's lap-46 stop at Monza it gives third, 1.1 s ahead of LEC, which is where he came out.

**Gaps and order.** The gap to the leader is the time between the first car completing a lap and each car completing the same lap. The order at the flag is the order on track, by laps completed and then by who finished the last of them first, so penalties aren't applied.

## Data, storage and permissions

Pit Wall reads public timing data from `api.openf1.org`, the only outside address the manifest lets it reach. It asks for three scopes:

| Scope | Why |
| --- | --- |
| `storage:app` | Caching sessions and debriefs, and remembering page links and filed issues |
| `read:jira-work` | Listing projects and issue types for filing a finding |
| `write:jira-work` | Creating the issue |

What it keeps in Forge storage:

- a finished session's timing data and its debrief, for 30 days
- the season and session lists, for 1 day
- which session each page debriefs and which Jira project it files in, so the agent can answer "this page"
- the key of each filed issue

It stores no names of people on your site. Lap and pit data is about drivers in public races.

## Limits

- OpenF1 has timing data from the 2023 season on.
- Stationary pit times exist in recent seasons only. Older stops are compared by pit lane time.
- The order at the flag is the order on track. Post-race penalties aren't applied.
- The numbers are as good as the public feed. A team running its own telemetry would replace `src/openf1` and `src/data` and keep the rest.
- The agent's wording comes from Rovo's model. The numbers come from the actions.

## Project layout

```
manifest.yml        the macro, the agent, its actions and the permissions
src/calc            the maths, no Forge imports, all tested
src/openf1          the OpenF1 client: a 400 ms pause between requests, retries on 429
src/data            compacting a session and caching it in Forge storage
src/service.ts      what the macro and the agent share
src/jira            creating issues
src/frontend        the macro and its settings, in UI Kit
src/index.ts        the resolver and the six agent actions
test                tests, with the 2025 Italian Grand Prix as a fixture
```

## Development

Needs Node.js 22.23.4 or later and the [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/).

```bash
npm install
npm test
npm run typecheck
forge deploy
forge install
```

## Credits

Timing data from [OpenF1](https://openf1.org). The session data handling is ported from my earlier project, [Formula Analyst](https://github.com/OhKazakh/formula-analyst).

Released under the [MIT License](LICENSE). See also the [privacy policy](PRIVACY.md) and [terms of use](TERMS.md).
