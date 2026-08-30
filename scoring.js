// Pure scoring functions — import config from scoring.config.js
// These functions are stateless and testable

import {
  ACTIVITY_GOALS,
  NUTRITION_GOALS,
  WATER_GOAL_ML,
  SLEEP_GOAL_HRS,
  MAX_PTS,
  STATUS_THRESHOLDS,
  STATUS_EMOJI
} from './scoring.config.js';

export {
  ACTIVITY_GOALS,
  NUTRITION_GOALS,
  WATER_GOAL_ML,
  SLEEP_GOAL_HRS
};

// Calculate percentage achieved (0 to 1, capped at 1)
function pct(actual, goal) {
  return Math.min(1, Math.max(0, actual / goal));
}

// Calculate activity points from multiple entries (e.g., two walks in one day)
// entries = [{type: "walking", value: 8542}, ...]
function activityPoints(entries) {
  if (!entries || entries.length === 0) return 0;
  
  let totalPct = 0;
  entries.forEach(entry => {
    const actType = entry.type.toLowerCase().split(' ').pop(); // Extract key from "👟 Walking"
    const goal = ACTIVITY_GOALS[actType]?.goal || ACTIVITY_GOALS.other.goal;
    totalPct += pct(entry.value, goal);
  });
  
  // Cap at 1.0 before multiplying by MAX_PTS (no overshoot compensation)
  return Math.min(1, totalPct) * MAX_PTS.activity;
}

// Calculate nutrition points from macro intake vs goals
// intake = {protein: 55, fibre: 20, carbs: 180, fats: 60}
function nutritionPoints(intake) {
  const keys = Object.keys(NUTRITION_GOALS);
  let totalPct = 0;
  
  keys.forEach(key => {
    const actual = intake[key] || 0;
    const goal = NUTRITION_GOALS[key];
    totalPct += pct(actual, goal);
  });
  
  const avgPct = totalPct / keys.length;
  return avgPct * MAX_PTS.nutrition;
}

// Calculate water points
function waterPoints(ml) {
  return pct(ml, WATER_GOAL_ML) * MAX_PTS.water;
}

// Calculate sleep points
function sleepPoints(hrs) {
  return pct(hrs, SLEEP_GOAL_HRS) * MAX_PTS.sleep;
}

// Determine status color (green/amber/red) based on percentage of goal
function statusColor(actualPct) {
  if (actualPct >= STATUS_THRESHOLDS.green) return 'green';
  if (actualPct >= STATUS_THRESHOLDS.amber) return 'amber';
  return 'red';
}

// Get emoji for a status color
function statusEmoji(color) {
  return STATUS_EMOJI[color] || '⚪';
}

// Calculate total score from all categories
function totalScore(member) {
  if (!member) return 0;
  
  const activity = activityPoints(member.activity || []);
  const nutrition = nutritionPoints(member.nutrition || {});
  const water = waterPoints(member.water || 0);
  const sleep = sleepPoints(member.sleep || 0);
  
  return Math.round(activity + nutrition + water + sleep);
}

// Get score breakdown for a member (for UI display)
function scoreBreakdown(member) {
  return {
    activity: Math.round(activityPoints(member.activity || [])),
    nutrition: Math.round(nutritionPoints(member.nutrition || {})),
    water: Math.round(waterPoints(member.water || 0)),
    sleep: Math.round(sleepPoints(member.sleep || 0)),
    total: totalScore(member)
  };
}

// Get category percentage for status display
function categoryPct(member, category) {
  const val = member[category];
  let goal;
  
  if (category === 'activity') {
    const sum = (val || []).reduce((s, e) => s + e.value, 0);
    goal = (val || []).length > 0 ? 
      (val || []).reduce((s, e) => s + (ACTIVITY_GOALS[e.type.toLowerCase().split(' ').pop()]?.goal || 45), 0) : 
      1;
    return pct(sum, goal);
  } else if (category === 'nutrition') {
    const keys = Object.keys(NUTRITION_GOALS);
    let total = 0;
    keys.forEach(k => total += pct(val[k] || 0, NUTRITION_GOALS[k]));
    return total / keys.length;
  } else if (category === 'water') {
    return pct(val || 0, WATER_GOAL_ML);
  } else if (category === 'sleep') {
    return pct(val || 0, SLEEP_GOAL_HRS);
  }
  return 0;
}

// Find weakest category for motivational nudge
function weakestCategory(member) {
  const categories = ['activity', 'nutrition', 'water', 'sleep'];
  let weakest = 'activity';
  let minPct = categoryPct(member, 'activity');
  
  categories.forEach(cat => {
    const p = categoryPct(member, cat);
    if (p < minPct) {
      minPct = p;
      weakest = cat;
    }
  });
  
  return { category: weakest, pct: minPct };
}

// Generate motivational message (viewer-only, only for logged-in user's row)
function motivationalMessage(member, leaderScore, memberIsViewer) {
  if (!memberIsViewer) return '';
  
  const myScore = totalScore(member);
  const gap = leaderScore - myScore;
  
  if (myScore >= leaderScore) {
    return "You're #1! Keep your crown 👑";
  }
  
  const weak = weakestCategory(member);
  const weakPct = Math.round(weak.pct * 100);
  
  // Build nudge message for weakest category
  let nudge = '';
  if (weak.category === 'activity') {
    nudge = `Incomplete activity today`;
  } else if (weak.category === 'nutrition') {
    const avgNeeded = Math.round((100 - weakPct) * 0.3); // Rough estimate
    nudge = `🍱 ${avgNeeded}g more protein for green!`;
  } else if (weak.category === 'water') {
    const needed = Math.round((WATER_GOAL_ML - (member.water || 0)) / 1000 * 10) / 10;
    nudge = `💧 ${needed}L more for green!`;
  } else if (weak.category === 'sleep') {
    const needed = Math.round((SLEEP_GOAL_HRS - (member.sleep || 0)) * 10) / 10;
    nudge = `😴 ${needed}h more for green!`;
  }
  
  return `${gap} pts behind leader — ${nudge}`;
}

export {
  pct,
  activityPoints,
  nutritionPoints,
  waterPoints,
  sleepPoints,
  statusColor,
  statusEmoji,
  totalScore,
  scoreBreakdown,
  categoryPct,
  weakestCategory,
  motivationalMessage
};
