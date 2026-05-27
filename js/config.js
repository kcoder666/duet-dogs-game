// Global config: brand palette, gameplay tuning, scoring rules.
// Kept framework-free so the values can be reused if ported to native later.

export const BRAND = {
  cream: '#FFF5D6',
  creamDeep: '#FFE9AE',
  brown: '#2B1D10',
  brownSoft: '#5A4126',
  gold: '#B8862E',
  blue: '#397FC5',
  pink: '#F4A6B8',
  green: '#7CB85F',
};

// Timing windows in seconds around a treat's exact hit time.
export const HIT_WINDOW = {
  perfect: 0.075,
  good: 0.15,
};

// Score awarded per judgement (before combo multiplier).
export const SCORE = {
  perfect: 100,
  good: 50,
};

// Happiness meter (the "lives" of the game).
export const HAPPINESS = {
  max: 100,
  start: 100,
  perfectGain: 2,
  goodGain: 1,
  missLoss: 9,
  decoyLoss: 14, // catching a decoy treat hurts more than a plain miss
};

// Combo grants a multiplier: +0.5x every COMBO_STEP, capped at COMBO_CAP.
export const COMBO_STEP = 8;
export const COMBO_CAP = 4;

// Treat falls from top of the play field to the hit line over this many
// seconds. Lower = harder (less reaction time). Overridable per song.
export const DEFAULT_FALL_TIME = 1.9;

// Rank thresholds by accuracy (0..1) used on the results screen.
export const RANKS = [
  { rank: 'S', min: 0.95 },
  { rank: 'A', min: 0.85 },
  { rank: 'B', min: 0.7 },
  { rank: 'C', min: 0.5 },
  { rank: 'D', min: 0 },
];

export function rankFor(accuracy) {
  return (RANKS.find((r) => accuracy >= r.min) || RANKS[RANKS.length - 1]).rank;
}

export function comboMultiplier(combo) {
  return Math.min(1 + Math.floor(combo / COMBO_STEP) * 0.5, COMBO_CAP);
}
