// Scoring configuration — single source of truth for all thresholds and goals
// Import this in app.js and use with pure functions in scoring.js

export const ACTIVITY_GOALS = {
  walking: { unit: "steps", goal: 10000 },
  running: { unit: "km", goal: 5 },
  cycling: { unit: "km", goal: 15 },
  swimming: { unit: "min", goal: 45 },
  yoga: { unit: "min", goal: 45 },
  strength: { unit: "min", goal: 45 },
  other: { unit: "min", goal: 45 }
};

export const NUTRITION_GOALS = {
  protein: 60,  // grams
  fibre: 25,    // grams
  carbs: 250,   // grams
  fats: 65      // grams
};

export const WATER_GOAL_ML = 2000;

export const SLEEP_GOAL_HRS = 8;

export const MAX_PTS = {
  activity: 25,
  nutrition: 25,
  water: 25,
  sleep: 25
};

// Status thresholds: pct of goal required for green/amber/red
export const STATUS_THRESHOLDS = {
  green: 0.9,   // 90% of goal = green
  amber: 0.5    // 50% of goal = amber; below = red
};

// Emoji mappings for status colors
export const STATUS_EMOJI = {
  green: "🟢",
  amber: "🟠",
  red: "🔴"
};

// Activity type display names (for UI labels)
export const ACTIVITY_DISPLAY = {
  walking: "👟 Walking",
  running: "🏃 Running",
  cycling: "🚴 Cycling",
  swimming: "🏊 Swimming",
  yoga: "🧘 Yoga",
  strength: "🏋️ Strength"
};
