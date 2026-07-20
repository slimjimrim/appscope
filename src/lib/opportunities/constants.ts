/** Every opportunity-flag threshold in one place, so tuning is a one-file edit. */
export const OPP = {
  /** low-competition flag: demand floor / competition ceiling */
  MIN_POPULARITY: 40,
  MAX_DIFFICULTY: 40,
  /** ranking-gap flag: demand floor, and the rank we consider "good enough" */
  GAP_MIN_POPULARITY: 35,
  GAP_RANK_THRESHOLD: 20,
  /** weak incumbents (shared with chart flags): what counts as a weak app */
  WEAK_AVG_RATING: 4.0,
  WEAK_MIN_RATING_COUNT: 50,
  /** weak-incumbents flag: how many of the top 10 must be weak */
  WEAK_TOP10_COUNT: 4,
  /** chart flags */
  NEW_ENTRANT_DAYS: 90,
  NEW_ENTRANT_MAX_RANK: 100,
  FAST_CLIMBER_POSITIONS: 20,
  FAST_CLIMBER_WINDOW_DAYS: 7,
  /** per-country cap on scanned keyword candidates (~3.2s of throttle each) */
  MAX_CANDIDATES: 80,
};
