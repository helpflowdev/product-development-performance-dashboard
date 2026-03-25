# 📚 Documentation Index

Welcome! Here's a guide to understanding this project.

---

## 🎯 Which Document Should You Read?

### ⚡ **5 Minutes?** → `QUICK_START.md`
- 30-second summary of what this is
- Quick setup instructions (5 mins)
- Common commands
- How to use the dashboard
- Debug tips

### 📖 **30 Minutes?** → `PROJECT_OVERVIEW.md`
- Full explanation of what the project does
- Step-by-step how it works
- Folder structure with descriptions
- Detailed setup instructions
- Troubleshooting guide
- Tech stack overview

### 🏗️ **Deep Dive?** → `ARCHITECTURE.md`
- System architecture diagrams
- Each component explained in detail
- Data flow examples
- Algorithm explanations
- Code patterns used
- Extension points for customization

---

## 📋 Quick Reference

### I just want to run it
```bash
npm install
# Create .env.local with your Google credentials
npm run dev
# Visit http://localhost:3000
```
→ See `QUICK_START.md` Step 1-3

### I want to understand what this does
→ Read `PROJECT_OVERVIEW.md` (sections: "What This Project Does" + "How It Works")

### I want to customize or extend it
→ Read `ARCHITECTURE.md` (sections: "Architecture", "Component Breakdown", "Extension Points")

### I'm stuck with a problem
→ Check `QUICK_START.md` "Common Errors & Fixes" section

---

## 🗂️ Project Structure at a Glance

```
📦 Product Development Performance Dashboard
├── 📄 QUICK_START.md              ← Start here!
├── 📄 PROJECT_OVERVIEW.md         ← Full guide
├── 📄 ARCHITECTURE.md             ← Deep technical dive
├── 📄 DOCUMENTATION_INDEX.md      ← This file
├── 📄 package.json                ← Dependencies & scripts
├── 📄 .env.local                  ← Your Google credentials (you create this)
│
├── 📁 src/
│   ├── app/                       ← Pages & routes
│   │   ├── page.tsx               (home → redirects)
│   │   ├── burndown/              ⭐ Main dashboard
│   │   ├── completion-rate/       (coming soon)
│   │   └── api/                   ← Backend endpoints
│   │       ├── sprints/route.ts   (GET list of sprints)
│   │       └── burndown/route.ts  (POST calculate)
│   │
│   ├── lib/                       ← Business logic
│   │   ├── sheets.ts              (Google Sheets API)
│   │   ├── burndown-engine.ts     ⭐ Main calculations
│   │   ├── row-mapper.ts          (data conversion)
│   │   └── date-utils.ts          (date helpers)
│   │
│   ├── types/                     ← TypeScript types
│   │   ├── sprint.ts
│   │   └── burndown.ts
│   │
│   └── components/                ← React components
│       ├── ui/                    (Card, Badge, Spinner)
│       ├── layout/                (Sidebar)
│       └── burndown/              (Chart, Table, Selectors)
│
└── 📁 public/                     ← Static assets
```

---

## 🚀 Key Concepts (TL;DR)

| Concept | Meaning |
|---------|---------|
| **Sprint** | 1-2 week period where team works on tasks |
| **Burndown** | Chart showing daily progress through sprint |
| **Story Points** | Effort estimate for a task (1, 2, 3, 5, 8...) |
| **Allotted Points** | Total points planned for the sprint |
| **Ideal Burn** | How fast you should complete work to finish on time |
| **Actual Burn** | How fast you're actually completing work |
| **QA Flags** | Data quality warnings (missing dates, etc.) |

---

## 🔄 How It Works (60-Second Version)

1. **Read**: API fetches task data from Google Sheets
2. **Parse**: Converts raw data to typed objects
3. **Filter**: Gets tasks for selected sprint
4. **Calculate**: For each day, counts completed story points
5. **Compare**: Shows actual vs ideal pace
6. **Display**: Renders chart, table, and stats

---

## ⚙️ Setup Checklist

- [ ] Node.js v18+ installed
- [ ] npm installed (comes with Node.js)
- [ ] Google Cloud Project created
- [ ] Google Sheets API enabled
- [ ] Service Account created
- [ ] JSON key downloaded
- [ ] Google Sheet shared with service account
- [ ] `.env.local` created with credentials
- [ ] `npm install` completed
- [ ] `npm run dev` started
- [ ] http://localhost:3000 opens in browser

→ See `QUICK_START.md` for step-by-step

---

## 🎯 What Each File Does

### Configuration
- `package.json` - Project metadata & dependencies
- `tsconfig.json` - TypeScript settings
- `next.config.ts` - Next.js settings
- `tailwind.config.js` - Tailwind CSS settings
- `.env.local` - Secrets (you create this)

### Pages
- `src/app/page.tsx` - Home (redirects to burndown)
- `src/app/layout.tsx` - Main layout with sidebar
- `src/app/burndown/page.tsx` - ⭐ Main dashboard
- `src/app/completion-rate/page.tsx` - Coming soon

### API
- `src/app/api/sprints/route.ts` - GET list of sprints
- `src/app/api/burndown/route.ts` - POST calculate burndown
- `src/app/api/health/route.ts` - Health check

### Business Logic
- `src/lib/sheets.ts` - Reads Google Sheets
- `src/lib/row-mapper.ts` - Converts data format
- `src/lib/burndown-engine.ts` - ⭐ Core calculations
- `src/lib/date-utils.ts` - Date parsing & formatting

### Types
- `src/types/sprint.ts` - Sprint & task interfaces
- `src/types/burndown.ts` - Burndown response types

### Components
- `src/components/layout/Sidebar.tsx` - Navigation
- `src/components/ui/*.tsx` - Reusable UI pieces
- `src/components/burndown/*.tsx` - Dashboard components

---

## 📊 Data Flow Diagram

```
Google Sheets (raw data)
        ↓
    fetchSheetRows() [sheets.ts]
        ↓ [2D string array]
mapRowsToSprintRows() [row-mapper.ts]
        ↓ [typed SprintRow objects]
API /api/sprints or /api/burndown
        ↓
computeBurndown() [burndown-engine.ts]
        ↓ [BurndownResponse with charts & flags]
React Components [BurndownChart, BurndownTable]
        ↓
Visual Dashboard in Browser
```

---

## 🛠️ Common Tasks

### Run Development Server
```bash
npm run dev
```
Auto-reloads on code changes. Visit http://localhost:3000

### Build for Production
```bash
npm run build
```
Creates optimized build in `.next/` folder

### Start Production Build
```bash
npm run build
npm start
```
Runs the optimized version (slower dev, faster in production)

### Lint Code
```bash
npm run lint
```
Checks code style using ESLint

### Test API Manually
```bash
# Get sprints
curl http://localhost:3000/api/sprints

# Calculate burndown (POST)
curl -X POST http://localhost:3000/api/burndown \
  -H "Content-Type: application/json" \
  -d '{"sprintId":"Sprint #2025.Q1.S1","allottedPoints":50}'
```

---

## ❓ Frequently Asked Questions

**Q: Where does the data come from?**
A: Google Sheets (Asana export). Set up in `.env.local`.

**Q: Can I edit the data in this dashboard?**
A: No, it's read-only. Edit the Google Sheet directly.

**Q: Why is the first load slow?**
A: Google Sheets API takes 5-10 seconds. Subsequent loads use 60-second cache.

**Q: Can I add more sprints?**
A: Yes, add rows to your Google Sheet. System auto-discovers them.

**Q: How do I change the colors/layout?**
A: Edit React components in `src/components/burndown/` or `src/app/burndown/page.tsx`. Use Tailwind CSS classes.

**Q: Can I deploy this online?**
A: Yes! Use Vercel (easiest) or any Node.js hosting. Add `.env` variables to the host.

**Q: How do I fix "GOOGLE_SERVICE_ACCOUNT_EMAIL is undefined"?**
A: Create `.env.local` file in the root with your credentials.

→ See `QUICK_START.md` "Troubleshooting" for more

---

## 📚 Learning Resources

### About This Project
- `PROJECT_OVERVIEW.md` - Everything about this project
- `QUICK_START.md` - Fast reference
- `ARCHITECTURE.md` - Technical details

### External Resources
- [Next.js Docs](https://nextjs.org/docs) - Web framework
- [React Docs](https://react.dev) - UI library
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Recharts](https://recharts.org) - Charts
- [Google Sheets API](https://developers.google.com/sheets/api) - Data source
- [TypeScript](https://www.typescriptlang.org) - Type safety

---

## 🐛 Debugging Tips

### Check Server Logs
Watch the terminal where you ran `npm run dev`. Look for:
```
[sheets] Fetched 142 rows
[burndown] Sprint: Sprint #2025.Q1.S1, Days: 10, Allotted: 50
```

### Check Browser Console
Press `F12` in the browser, go to **Console** tab for error messages

### Check Network Requests
In `F12` → **Network** tab, click on API requests to see responses

### Test APIs Manually
Use `curl` or Postman to test endpoints directly (see Common Tasks above)

### Clear Cache
Server-side cache expires after 60 seconds. Restart `npm run dev` to clear immediately.

---

## 📞 Need Help?

1. **Setup questions?** → `QUICK_START.md` "5-Minute Setup"
2. **Understanding code?** → `ARCHITECTURE.md`
3. **Errors?** → `QUICK_START.md` "Common Errors & Fixes"
4. **Want to customize?** → `ARCHITECTURE.md` "Extension Points"

---

## ✅ Next Steps

1. **Get it running** → Follow `QUICK_START.md`
2. **Explore the code** → Start with `src/app/burndown/page.tsx`
3. **Understand the data** → Read `PROJECT_OVERVIEW.md` "The Data Flow"
4. **Make it yours** → Edit components and deploy!

---

**Happy sprinting! 🚀**
