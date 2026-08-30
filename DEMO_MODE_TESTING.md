# Demo Mode Testing Guide

## What's New
Demo mode has been successfully integrated! Users can now test NutriFam without email verification.

## How to Use Demo Mode

### 1. Start the App
Open `index.html` in a browser (with an HTTP server to avoid CORS issues):
```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

### 2. Click "Try Demo Mode" Button
- The auth modal appears on app load (no user logged in)
- Click the **"🎬 Try Demo Mode"** button at the bottom of the modal
- The app loads with sample family data

### 3. Explore All Features
- **Dashboard**: Log water, sleep, activities, meals, protein shake
- **Meals**: Add foods from the database, track nutrition
- **Family**: View leaderboard with pre-populated family member scores
- **Progress**: See 7-day trends and streaks

## Key Demo Features

### Sample Family Data (Pre-Populated)
- Arpita (You) — empty log, ready to track
- Mom — 8,450 steps, 2L water, 7.5h sleep, nutrition logged
- Dad — 4km run, 2L water, 8h sleep, nutrition logged  
- Brother — 6,210 steps, 1.2L water, 6h sleep, nutrition logged

### Demo User
- ID: `demo-user-123`
- Email: `demo@nutrifam.test` (not real, no auth needed)
- Display name: `Demo User`

### What's NOT Saved (Demo Mode)
- Saves to Supabase are **no-op** (skipped)
- All data is **in-memory only** (resets on page reload)
- Family creation, joining, and invites are **disabled** (Supabase operations)

## Testing Checklist

### Dashboard Tab
- [ ] Water buttons (+250ml, +500ml, +1L) work and update progress bar
- [ ] Sleep input saves and updates status
- [ ] Shake button toggles and shows protein amount
- [ ] Activity dropdown shows all options (Walking, Running, Cycling, Swimming, Yoga, Strength)
- [ ] Progress ring shows percentage
- [ ] Streak count displays (increments on 100% completion)

### Meals Tab
- [ ] Food dropdown shows available items
- [ ] Quantity input updates preview (calories, protein, carbs, fat)
- [ ] "Add to today's meals" button adds meal to log
- [ ] Meal summary shows total calories and macros
- [ ] Remove button deletes meals

### Family Tab
- [ ] Leaderboard displays all family members
- [ ] Rank badges show (👑🥈🥉 or numbers)
- [ ] Member stats show breakdown (🔥 activity, 🍱 nutrition, 💧 water, 😴 sleep)
- [ ] Your own row shows motivational message (if not leader)
- [ ] Other members' rows don't show motivational messages

### Progress Tab
- [ ] Best streak shows current count
- [ ] Average score calculated from history
- [ ] Water/sleep goals count from last 7 days
- [ ] Week chart displays daily scores

## Known Limitations in Demo Mode

1. **No Supabase Persistence**: Refreshing the page resets all data
2. **No Auth**: Can't sign up/sign in with real email (email confirmation required)
3. **No Family Operations**: Create family, join family, and invite links are disabled
4. **Sample Family Only**: Can't create or switch families

## When to Use Real Auth

Once Supabase email confirmation is disabled (in dashboard settings), users can:
- Sign up with email/password
- Create families and invite members
- Data persists across sessions
- Join families via invite tokens

## Files Changed

- **index.html**: Added "🎬 Try Demo Mode" button to auth modal
- **app.js**: 
  - Imported `enableDemoMode` and `isDemoMode` from auth.js
  - Added demo mode button handler
  - Updated `save()` to skip Supabase in demo mode
  - Updated initialization to skip Supabase calls in demo mode
- **auth.js**: Already had `enableDemoMode()` and `isDemoMode()` functions (no changes needed)

## Demo Mode Flow

```
App Load (no user)
  ↓
Show Auth Modal
  ↓
Click "Try Demo Mode"
  ↓
enableDemoMode() sets flag & demo user
  ↓
Page Reload
  ↓
App Initialization
  ↓
getCurrentUser() returns DEMO_USER
  ↓
isDemoMode() returns true
  ↓
Load Sample Family Data (defaultData)
  ↓
Skip Supabase calls
  ↓
Render Full Dashboard
  ↓
User Can Explore All Features
  ↓
save() calls are no-ops (data stays in-memory)
```

## Quick Test

1. Open app, click "🎬 Try Demo Mode"
2. Log 500ml water (should show 25% water progress)
3. Log 8 hours sleep (should show 100% sleep progress)  
4. Add a 100g meal of "Paneer" (should show ~265 kcal, 18g protein)
5. View family leaderboard — your score should update
6. Refresh page — all data resets (as expected in demo mode)
