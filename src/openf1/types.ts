// The parts of OpenF1's responses that Pit Wall reads. https://openf1.org

export interface Meeting {
  meeting_key: number;
  meeting_name: string;
  location: string;
  country_name: string;
  date_start: string;
  year: number;
}

export interface Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  location: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
  is_cancelled?: boolean;
}

export interface Driver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string | null;
  team_colour: string | null;
}

export interface Lap {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  is_pit_out_lap: boolean | null;
}

export interface Stint {
  driver_number: number;
  stint_number: number;
  compound: string | null;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number | null;
}

// `date` is when the car left the pit lane, `lane_duration` the time since it entered,
// and `stop_duration` the time the car stood still.
export interface Pit {
  driver_number: number;
  lap_number: number;
  date: string;
  lane_duration: number | null;
  stop_duration: number | null;
}

export interface RaceControl {
  date: string;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  message: string | null;
}
