# Pit Wall

Pit Wall turns a race session's timing data into a debrief in Confluence, a Rovo agent that answers questions about it, and Jira issues for what needs a look. It is an Atlassian Forge app.

The demo uses public Formula 1 timing data from [OpenF1](https://openf1.org). A real team would plug in its own telemetry instead. Pit Wall is unofficial and not associated with Formula 1 or any team.

## How the numbers are worked out

All the maths lives in [`src/calc`](src/calc) and is covered by tests in [`test`](test), including a run on the 2025 Italian Grand Prix as OpenF1 served it.

**Clean laps.** A lap counts as clean when it has a time, its three sectors add up to it within 0.1 s, it isn't an in-lap or out-lap, it isn't a race's opening lap, and no safety car, virtual safety car or red flag was out at any point during it. The track status comes from race control's messages, the same way FastF1 builds it. On top of that, laps more than 7% slower than the session's fastest clean lap are left out as traffic or incidents.

**Fuel correction.** A car gets lighter as it burns fuel. Each race lap is corrected by 0.055 s for every lap of fuel still on board: `corrected = lap time - 0.055 × (race laps - lap number)`. 0.055 s is the usual public estimate; a team would use its own.

**Tyre wear.** For each stint with at least 8 clean laps, Pit Wall fits a straight line through the fuel-corrected lap times against tyre age (least squares). The slope is the wear: seconds lost per lap of tyre age. A straight line averages out the tyre warming up at the start of a stint and dropping off at the end.

**High wear.** A stint is a finding when its wear is at least 0.05 s per lap above the median of all stints on the same compound in that session, and at least half again that median. The compound needs at least 3 stints with a wear figure to compare against.

**Pit stops.** OpenF1 gives each visit's pit lane time and, in recent seasons, the time the car stood still. Pit Wall uses the stationary time where it exists, because that is the crew's part of the stop, and pit lane time otherwise. A time penalty served at the stop is taken out, matched from race control's "penalty served" message within 5 minutes of the car leaving. Visits over 60 s in the pit lane are red-flag stops or repairs and are left out.

**Slow stops.** A stop is a finding when it is at least 1.5 s slower than its team's median stop in that session. A team needs at least 3 stops for its own median; below that, the session's median is used.

**Gaps and order.** The gap to the leader is the time between the first car completing a lap and each car completing the same lap. The order at the flag is the order on track, by laps completed and then by who finished the last of them first, so penalties aren't applied.

## Development

Needs Node.js 22.23.4 or later and the [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/).

```bash
npm install
npm test
npm run typecheck
```

## Credits

Timing data from [OpenF1](https://openf1.org). The session data handling is ported from my earlier project, [Formula Analyst](https://github.com/OhKazakh/formula-analyst).

Released under the [MIT License](LICENSE).
