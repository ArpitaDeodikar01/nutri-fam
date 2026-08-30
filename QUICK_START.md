# NutriFam Quick Start

## Run the App Locally

### Option 1: Python (Recommended)
```bash
cd d:\projects\nutri-fam
python -m http.server 8000
# Visit: http://localhost:8000
```

### Option 2: Node.js
```bash
npx http-server
# or
npx serve
```

### Option 3: Live Server (VS Code)
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

## Test Demo Mode

1. **Load the app** → Auth modal appears
2. **Click "🎬 Try Demo Mode"** → Sample family data loads
3. **Explore all features**:
   - Log water, sleep, activities
   - Add meals from database
   - View family leaderboard
   - Check progress trends

No email needed. No sign-up required.

## File Structure

```
d:\projects\nutri-fam\
├── index.html               # Main UI (HTML + inline styles in modals)
├── styles.css              # Mobile-first CSS
├── app.js                  # Main app logic (imports modules)
├── auth.js                 # Auth + demo mode
├── scoring.js              # Scoring functions
├── scoring.config.js       # Config constants (no functions)
├── supabase-config.js      # Supabase client init
├── supabase-db.js          # Database operations
└── README.md               # Project docs
```

## Architecture

### Import Structure
```
index.html
  ↓ loads supabase-config.js → window.supabaseClient
  ↓ loads app.js (module)
    ├─ imports auth.js
    ├─ imports supabase-db.js
    └─ imports scoring.js + scoring.config.js
```

### Data Flow
```
User Input
  ↓
app.js handlers (save, renderAll, etc)
  ↓
save() → saveDailyLog() [Supabase]
  ↓
render*() → scoring functions → UI
```

### Auth State
```
Demo Mode:
  enableDemoMode() → useDemoMode = true → currentUser = DEMO_USER

Real Auth:
  signIn() → supabase.auth.signInWithPassword() → currentUser = user
```

## Key Functions

### User Auth
- `getCurrentUser()` — Get logged-in user (or DEMO_USER)
- `signIn(email, password)` — Real auth
- `signUp(email, password)` — Real auth
- `enableDemoMode()` — Bypass auth
- `isDemoMode()` — Check if in demo mode

### Data Persistence
- `saveDailyLog(data)` — Save to Supabase (no-op in demo)
- `loadTodayLog()` — Load today's log from Supabase
- `loadFamilyLeaderboard()` — Load all members' scores

### Scoring
- `totalScore(member)` — Calculate 0-100 score
- `scoreBreakdown(member)` — Get category breakdown
- `categoryPct(member, category)` — Get % for one category
- `motivationalMessage(member, leaderScore, isViewer)` — Personal nudge

## Scoring System

**25-25-25-25 Split:**
- 🔥 **Activity**: 25 pts (walking, running, cycling, etc.)
- 🍱 **Nutrition**: 25 pts (protein, fibre, carbs, fats averaged)
- 💧 **Water**: 25 pts (goal: 2L)
- 😴 **Sleep**: 25 pts (goal: 8 hours)

**Example Calculation:**
```javascript
member = {
  activity: [{type: "walking", value: 8000}],
  nutrition: {protein: 60, fibre: 20, carbs: 200, fats: 50},
  water: 2000,
  sleep: 7.5
}

score = totalScore(member)
// Activity: 8000/10000 = 0.8 → 20 pts
// Nutrition: avg 0.75 → 18.75 pts  
// Water: 2000/2000 = 1.0 → 25 pts
// Sleep: 7.5/8 = 0.9375 → 23.4 pts
// Total: ~87 pts
```

## Debugging

### Check Demo Mode Status
```javascript
// In browser console:
console.log(isDemoMode()) // true/false
console.log(getCurrentUser()) // DEMO_USER or real user
```

### Check Supabase Connection
```javascript
console.log(window.supabaseClient) // Should exist
```

### Monitor Save Operations
```javascript
// Check console for "Demo mode: skipping save to Supabase"
// or "✓ Supabase ready, starting app..."
```

### View Sample Data
```javascript
// In app.js, look at defaultData
console.log(data.family) // Sample members
console.log(data.today) // Today's log
```

## Common Tasks

### Add a New Food to Database
Edit `app.js` in `FOOD_DB` object:
```javascript
"Dosa": {
  calories: 290,
  protein: 8,
  carbs: 45,
  fat: 10
}
```

### Change Activity Types
Edit `scoring.config.js` in `ACTIVITY_GOALS`:
```javascript
ACTIVITY_GOALS: {
  walking: {goal: 10000, unit: "steps"},
  running: {goal: 5, unit: "km"},
  // Add more here
}
```

### Modify Sample Family
Edit `app.js` in `defaultData.family`:
```javascript
family: [
  {name: "Your Name", initials: "YN", ...},
  // Edit or add members
]
```

### Change Scoring Weights
Edit `scoring.config.js`:
```javascript
MAX_PTS: {
  activity: 25,
  nutrition: 25,
  water: 25,
  sleep: 25
}
```

## Troubleshooting

### "Supabase not initialized"
- Wait for page to fully load
- Check `supabase-config.js` runs before `app.js`
- Verify internet connection (CDN loading)

### Auth modal doesn't close
- Check demo button element exists: `document.getElementById("demoModeBtn")`
- Verify `enableDemoMode()` is being called
- Check browser console for errors

### Scores not updating
- Verify `save()` is being called
- Check that `totalScore()` receives proper member object
- In demo mode, use browser console to check `data.family`

### CSS doesn't look right
- Clear browser cache (Ctrl+Shift+Delete)
- Check `styles.css` is loaded
- Verify viewport meta tag in `index.html`

## Next Steps

### For Testing
→ See `DEMO_MODE_TESTING.md`

### For Full Auth
1. Disable email confirmation in Supabase
2. Test sign-up/sign-in flow
3. Test family creation
4. Test invite tokens

### For Production
1. Add password reset flow
2. Add family settings page
3. Add notifications/reminders
4. Add data export
5. Host on Vercel/Netlify

---

**Questions?** Check the main `README.md` for full documentation.
