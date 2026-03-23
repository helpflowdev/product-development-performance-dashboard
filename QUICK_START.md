# Quick Start Guide

## ⚡ 30-Second Summary

This is a **sprint progress tracker** that reads tasks from **Google Sheets**, calculates **daily progress**, and shows you a **burndown chart**.

Think: *GitHub Issues → Asana → Google Sheets → Dashboard*

---

## 🚀 Get Running in 5 Minutes

### 1. Install
```bash
cd c:\Python\product-dev-performance-dashboard
npm install
```

### 2. Create `.env.local`
Create a file in the root folder with:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1a2b3c4d5e6f...
GOOGLE_SHEET_RANGE=Sprints!A:W
```

### 3. Start
```bash
npm run dev
```
Open http://localhost:3000 ✨

---

## 📖 The Data Flow

```
┌─────────────────────┐
│  Google Sheets      │ ← Asana export (task data)
│  (Raw CSV-like)     │
└──────────┬──────────┘
           │
           ↓
    ┌──────────────┐
    │ fetchSheetRows() │ ← API connects
    │ (lib/sheets.ts)  │
    └──────┬───────┘
           │ Caches for 60 seconds
           ↓
    ┌──────────────────┐
    │ mapRowsToSprintRows() │ ← Convert to typed data
    │ (lib/row-mapper.ts)   │
    └──────┬───────────┘
           │
           ↓
    ┌──────────────────┐
    │ computeBurndown()  │ ← Calculate daily progress
    │ (lib/burndown-engine.ts) │
    └──────┬───────────┘
           │
           ↓
    ┌──────────────────┐
    │ BurndownResponse │ ← Return chart data
    │ (JSON)           │
    └──────┬───────────┘
           │
           ↓
    ┌──────────────────┐
    │ React Components │ ← Draw charts & tables
    │ (BurndownChart,  │
    │  BurndownTable)  │
    └──────────────────┘
```

---

## 🎮 How to Use (3 Clicks)

1. **Pick Sprint** → Dropdown menu (newest first)
2. **Enter Points** → How many you planned to complete
3. **Click Generate** → See the chart

**Done!** You'll see:
- 📊 A chart comparing actual vs ideal progress
- 📋 A table with daily details
- ⚠️ A log of any data quality issues

---

## 🧰 Common Commands

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start development server (auto-reloads) |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Check code style |

---

## 🔧 Project Layout (5-Minute Tour)

```
src/
├── app/               ← Pages users see
│   ├── page.tsx       (home → redirects to burndown)
│   ├── burndown/      (⭐ Main page)
│   └── completion-rate/ (Coming soon)
│
├── api/               ← Backends (invisible to users)
│   ├── /sprints       (GET list of sprints)
│   └── /burndown      (POST calculate & return data)
│
├── lib/               ← Business logic
│   ├── sheets.ts      (Reads Google Sheets)
│   ├── row-mapper.ts  (Converts data format)
│   ├── burndown-engine.ts (⭐ Does the math)
│   └── date-utils.ts  (Date helpers)
│
├── types/             ← Type definitions
│   ├── sprint.ts
│   └── burndown.ts
│
└── components/        ← Reusable UI pieces
    ├── ui/            (Card, Badge, Spinner)
    └── burndown/      (Sprint selector, Chart, Table)
```

---

## 🤔 What Happens When You Click "Generate"

```javascript
// You click Generate with:
// - Sprint: "Sprint #2025.Q1.S1"
// - Points: 50

// Frontend sends POST /api/burndown with:
{
  sprintId: "Sprint #2025.Q1.S1",
  allottedPoints: 50
}

// Backend:
// 1. Fetches Google Sheet (or uses cache)
// 2. Maps it to typed data
// 3. Filters to selected sprint
// 4. For each day in sprint:
//    - Counts completed story points
//    - Calculates remaining
//    - Compares to ideal pace
// 5. Returns chart data + warnings

// Frontend draws:
// - Chart (Recharts library)
// - Table (HTML)
// - Stats boxes
// - QA warnings
```

---

## ⚙️ The Google Sheets Format

Your Asana export sheet must have these columns:
```
Sprint | Sprint Date Start | Sprint Date End | Tasks Title | Status | Story Points | Date Completed for Burndown | ...
```

The system is **column-name safe** — it looks for exact column names, not positions. So if you rearrange columns, it still works.

---

## 🎯 Key Algorithms

### Burndown Calculation
1. **Ideal Burn** = Total Points ÷ (Sprint Days - 1)
2. **Daily Cumulative** = Sum of all completed story points up to that day
3. **Remaining** = Total Points - Cumulative
4. **Ideal Remaining** = Total Points - (Day Number × Daily Burn)

### Example: 50 points, 10-day sprint
- Ideal burn per day: 50 ÷ 9 ≈ **5.6 points**
- Day 1: 3 done → 47 remaining (ideal: 44)
- Day 5: 22 done → 28 remaining (ideal: 22)

---

## 🐛 Debug Tips

### See Server Logs
Watch the terminal where you ran `npm run dev`:
```
[sheets] Fetched 142 rows
[burndown] Sprint: Sprint #2025.Q1.S1, Days: 10, Allotted: 50
```

### See Browser Errors
Press `F12` in the browser, go to **Console** tab

### Check Cache Status
Cache expires every 60 seconds, so if data doesn't update immediately, wait a minute or restart the server.

### Test the APIs Manually
```bash
# See list of sprints
curl http://localhost:3000/api/sprints

# Calculate burndown (POST)
curl -X POST http://localhost:3000/api/burndown \
  -H "Content-Type: application/json" \
  -d '{"sprintId":"Sprint #2025.Q1.S1","allottedPoints":50}'
```

---

## 📱 Browser Support
- Chrome, Edge, Safari, Firefox (all modern versions)
- Mobile-responsive (works on tablets/phones)

---

## 🔐 Security Notes
- Service account credentials are **server-side only** (never sent to browser)
- Sheet is read-only
- No user authentication (assumes trusted internal use)

---

## 🚀 Deployment

### To Vercel (free hosting)
```bash
npm run build
# Commit to GitHub
# Push to GitHub
# Vercel auto-deploys
```

Add `.env` variables in Vercel dashboard.

### To a server
```bash
npm run build
npm start
```

---

## 💡 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "GOOGLE_SERVICE_ACCOUNT_EMAIL is undefined" | Add `.env.local` with credentials |
| "Missing required column: 'Sprint'" | Sheet columns don't match; check column names |
| "No tasks found for this sprint" | No tasks with that sprint name in sheet |
| "Failed to fetch sprints" | Check Google Sheet is shared with service account |
| Chart takes 5+ seconds | Google Sheets API takes time; data is cached after |

---

## 📚 Files You'll Edit Most

1. **`.env.local`** — Credentials
2. **`src/app/burndown/page.tsx`** — Main page layout
3. **`src/lib/burndown-engine.ts`** — Calculation logic
4. **`src/components/burndown/**`** — UI components

---

## 🎓 Next Steps

1. **Get it running** → Follow the 5-minute setup above
2. **Load your data** → Make sure Google Sheet is set up
3. **Explore the code** → Read `PROJECT_OVERVIEW.md` for full details
4. **Customize** → Edit components to match your team's needs

Happy sprinting! 🚀
