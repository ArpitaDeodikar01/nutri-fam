# NutriFam — Working Web App MVP

A responsive family nutrition and wellness tracker with config-driven scoring, secure invite tokens, and mobile-first UI.

## Features
- **Dashboard** — Daily progress tracking with completion ring
- **Meals** — Automatic nutrition calculation (calories, protein, carbs, fats)
- **Activity** — Flexible activity types (walking, running, cycling, swimming, yoga, strength)
- **Water** — 2L daily goal with quick-add buttons (250ml, 500ml, 1L)
- **Sleep** — 8-hour goal tracking with hourly input
- **Scoring System** — Fair 25-25-25-25 point split (activity/nutrition/water/sleep, max 100/day)
  - Normalized scoring: no category overshoot compensates for another's weakness
  - Config-driven: single source of truth in `scoring.config.js`
- **Family Leaderboard** — Real-time score ranking with category breakdowns (🔥🍱💧😴)
  - Crown 👑 for #1, medals 🥈🥉 for top 3
  - Personalized motivational nudges (viewer-only)
  - Shows weakest category for each user
- **Family Creation** — Simple name input, secure token generation
- **Invite Flow** — Cryptographically-secure `?join=token` links + WhatsApp integration
  - Pre-filled message: "Join my NutriFam family! 💚 Track your health goals..."
  - Auto-join + redirect to leaderboard (no extra screens)
- **Progress View** — 7-day trends (best streak, avg score, goal completion)
- **Mobile-first** — 44px touch targets, no horizontal scroll, responsive grid/flex
- **LocalStorage** — Persists all data locally (no backend needed for MVP)

## Tech Stack
- **Vanilla JavaScript** (ES6 modules)
- **HTML/CSS** (no frameworks)
- **LocalStorage** (no database)
- **Crypto.getRandomValues()** (secure token generation)

## File Structure
```
nutri-fam/
├── app.js                 # Main app logic, UI handlers, family/invite management
├── scoring.js             # Pure scoring functions (testable, stateless)
├── scoring.config.js      # Single source of truth: goals, thresholds, MAX_PTS
├── index.html             # App structure + modals
├── styles.css             # Desktop + mobile-first responsive design
└── README.md              # This file
```

## Run It

### Quick Start (Python)
```bash
cd nutri-fam
python -m http.server 8000
# Open http://localhost:8000
```

### With Node.js
```bash
npx serve .
# Then open the URL shown
```

### ⚠️ Important
- **DO NOT** open `index.html` directly (`file://`)
- ES6 modules require HTTP protocol (CORS security)
- Use a local dev server

## How It Works

### Creating a Family
1. Click "Create family" → enter family name
2. System generates cryptographically-secure token (32 chars, unguessable)
3. Display invite link: `http://app.com?join=a3f7b2c1...`

### Sharing via WhatsApp
1. Click "💬 Share via WhatsApp"
2. Pre-filled message opens WhatsApp with invite link
3. Recipient clicks link → auto-joins family → redirected to leaderboard

### Scoring (Config-Driven)
Each category is calculated as:
```
% achieved = actual / goal (capped at 1.0)
points = % * MAX_PTS[category]
```

**Example:**
- Water: 1500ml / 2000ml = 75% → 19 pts
- Activity: 8500 steps / 10000 = 85% → 21 pts
- Nutrition: avg 87% across macros → 22 pts
- Sleep: 7.5h / 8h = 94% → 24 pts
- **Total: 86/100**

**Status Colors:**
- 🟢 Green = ≥90% of goal
- 🟠 Amber = ≥50% of goal
- 🔴 Red = <50% of goal

### Real-Time Leaderboard
- On save: score recalculated → family sorted → leaderboard re-rendered (no refresh)
- Motivational message (viewer-only):
  - If #1: "You're #1! Keep your crown 👑"
  - If behind: "X pts behind leader — [weakest category nudge]"

## Configuration

Edit `scoring.config.js` to customize:
```javascript
export const ACTIVITY_GOALS = {
  walking: { unit: "steps", goal: 10000 },
  running: { unit: "km", goal: 5 },
  // ... customize as needed
};

export const NUTRITION_GOALS = {
  protein: 60,  // grams
  fibre: 25,
  // ... customize
};

export const MAX_PTS = {
  activity: 25,
  nutrition: 25,
  water: 25,
  sleep: 25  // Total = 100 points/day max
};

export const STATUS_THRESHOLDS = {
  green: 0.9,   // 90% of goal
  amber: 0.5    // 50% of goal
};
```

Changes propagate instantly — all scores recompute on next render.

## Data Structure

**User's Daily Data:**
```javascript
data.today = {
  water: 1500,                          // ml
  activities: [
    {type: "walking", value: 8500},
    {type: "cycling", value: 5}
  ],
  nutrition: {
    protein: 55,   // grams
    fibre: 20,
    carbs: 180,
    fats: 50
  },
  sleep: 7.5,                           // hours
  shake: true,
  meals: [ ... ]
}
```

**Family Member:**
```javascript
{
  name: "Arpita",
  initials: "A",
  score: 86,                            // computed by totalScore()
  activity: [{type: "walking", value: 8500}],
  nutrition: {protein: 55, fibre: 20, carbs: 180, fats: 50},
  water: 1500,
  sleep: 7.5,
  status: "You"
}
```

**Family:**
```javascript
data.families = {
  "a3f7b2c1...": {
    name: "The Smiths",
    members: ["Arpita", "Mom", "Dad"],
    createdBy: "Arpita"
  }
}
```

## Important Notes

- **MVP Only** — LocalStorage; no backend sync between devices
- **No Real Invites** — WhatsApp link works for one browser session; multi-device sync requires backend
- **Nutrition Data** — Demo food database is approximate; not medical advice
- **Mobile-First** — Tested at 720px breakpoint; desktop still works

## Production Roadmap

To upgrade to a production app:
- [ ] Backend (Node.js/Express or similar)
- [ ] Database (MongoDB/PostgreSQL)
- [ ] Authentication (email/OAuth)
- [ ] Real family sync
- [ ] Push notifications
- [ ] Wearable integration (Google Fit, Apple HealthKit)
- [ ] Premium features (advanced analytics, meal planning)
- [ ] Admin dashboard (analytics, user management)

---

**Made with ❤️ for family wellness.**
