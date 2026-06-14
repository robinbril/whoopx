import type { ProfileOutT } from "../schemas/profile";

export const DEMO_PROFILE: ProfileOutT = {
  user_id: 10042801,
  account_id: 10042801,
  email: "alex@demo.whoopx.local",
  username: "alex_r",
  first_name: "Alex",
  last_name: "Rivera",
  birthday: "1992-07-22",
  gender: "male",
  height: { m: 1.84, cm: 184, ft: 6.04 },
  weight: { kg: 82.5, lb: 181.9 },
  city: "Amsterdam",
  country: "NL",
  timezone_offset: "+02:00",
  bio_data: {
    max_hr_bpm: 192,
    resting_hr_bpm: 54,
    min_hr_bpm: 38,
  },
  fitness_level: "FIT",
  membership: { status: "active", in_effect: true },
  privacy: { stealth_mode: false, body_comp_hidden: false, healthspan_hidden: false },
};
