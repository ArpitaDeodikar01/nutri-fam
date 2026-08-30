# NutriFam — Working Web App MVP

A responsive family nutrition and wellness tracker.

## Included
- Daily dashboard
- Meal entry with automatic calorie/protein/carbs/fat calculation
- Protein shake toggle
- 2L water tracker with quick-add buttons
- Manual step entry
- Daily completion percentage
- Streaks and motivational messages
- Family leaderboard
- Family step challenge
- Local invite simulation
- 7-day progress view
- LocalStorage persistence

## Run it
### Easiest
Open `index.html` directly in a modern browser.

### Recommended for development
If you have Node.js:
```bash
npx serve .
```
Then open the URL shown by the command.

## Important
This is an MVP and stores data in the browser's LocalStorage. The family invite is simulated locally; it does not actually send email or sync between devices.

## Production upgrade
For a real multi-user family app, add:
- Next.js + TypeScript frontend
- Authentication (email/Google)
- MongoDB/PostgreSQL database
- Server-side APIs
- Real invite emails
- Family membership/permissions
- Nutrition API
- Secure server-side validation
- Notifications
- Optional Google Fit / Health Connect integration

Nutrition values in the demo food database are approximate and should not be treated as medical or dietary advice.
