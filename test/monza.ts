import drivers from "./fixtures/monza-2025-race/drivers.json";
import laps from "./fixtures/monza-2025-race/laps.json";
import meetings from "./fixtures/monza-2025-race/meetings.json";
import pit from "./fixtures/monza-2025-race/pit.json";
import raceControl from "./fixtures/monza-2025-race/race_control.json";
import sessions from "./fixtures/monza-2025-race/sessions.json";
import stints from "./fixtures/monza-2025-race/stints.json";
import { compact } from "../src/data/session";
import type * as T from "../src/openf1/types";

// The 2025 Italian Grand Prix race at Monza, as OpenF1 served it, trimmed to the fields read.
export const monza = () =>
  compact(
    sessions[0] as T.Session,
    meetings[0] as T.Meeting,
    drivers as T.Driver[],
    laps as T.Lap[],
    stints as T.Stint[],
    pit as T.Pit[],
    raceControl as T.RaceControl[],
  );
