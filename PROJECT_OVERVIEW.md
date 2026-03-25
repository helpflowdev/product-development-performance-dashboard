# Product Development Performance Dashboard - Complete Guide

## 🎯 What This Project Does (In Plain English)

This is a **dashboard for visualizing how fast a development team completes work during a sprint**. Think of it like a progress tracker for a race — you set a finish line (the allotted story points), and this dashboard shows you:

- **How many points you've completed** each day
- **What the ideal pace should be** to finish on time
- **How close you are** to your goal
- **Data quality issues** (like missing dates or story points)

The team tracks their work in **Google Sheets** (using an Asana export), and this dashboard **pulls that data automatically** and creates visual charts so everyone can see how the sprint is going.

---

## 🏗️ How It Works (The Journey of Data)

```
Google Sheets (Raw Task Data)
          ↓
    API reads data (cached 60 sec)
          ↓
    Maps columns & validates
          ↓
    Burndown engine processes
          ↓
    Creates daily burndown stats
          ↓
    Dashboard displays charts
```

### Step-by-Step:

1. **Google Sheets** contains task data exported from Asana with columns like:
   - Task title, assignee, dates
   - Story points (effort estimate)
   - Status (Complete/Incomplete)
   - Sprint it belongs to

2. **API (`/api/sprints`)** fetches the sheet and extracts unique sprint names and dates

3. **API (`/api/burndown`)** takes a selected sprint and calculates:
   - Daily completion (how many points finished each day)
   - Ideal pace (what points should be done by now)
   - Actual vs ideal comparison
   - Quality flags (missing data, weird dates, etc.)

4. **Frontend** displays:
   - A **chart** showing actual vs ideal burndown
   - A **data table** with daily details
   - **Summary stats** (total points, completion rate)
   - A **QA log** listing any data issues

---

## 📁 Folder Structure & What Each Part Does

```
src/
├── app/
│   ├── page.tsx                 # Home page (redirects to /burndown)
│   ├── layout.tsx               # Main layout with sidebar
│   ├── globals.css              # Global styles (Tailwind)
│   │
│   ├── api/                     # Backend APIs
│   │   ├── sprints/route.ts     # GET sprints list
│   │   ├── burndown/route.ts    # POST burndown calculation
│   │   └── health/route.ts      # Health check
│   │
│   ├── burndown/page.tsx        # Main burndown chart page
│   └── completion-rate/page.tsx # Future feature (coming soon)
│
├── lib/                         # Utilities & business logic
│   ├── sheets.ts               # Google Sheets API connection
│   ├── row-mapper.ts           # Converts raw data to typed objects
│   ├── burndown-engine.ts      # Main calculation logic
│   └── date-utils.ts           # Date parsing & formatting
│
├── types/                       # TypeScript type definitions
│   ├── sprint.ts               # Sprint & task interfaces
│   └── burndown.ts             # Burndown calculation types
│
└── components/                  # React UI components
    ├── layout/
    │   └── Sidebar.tsx          # Navigation sidebar
    ├── ui/
    │   ├── Card.tsx             # Reusable card container
    │   ├── Badge.tsx            # Status badges
    │   └── LoadingSpinner.tsx    # Loading animation
    └── burndown/
        ├── SprintSelector.tsx       # Dropdown to pick sprint
        ├── AllottedPointsSelect.tsx # Input for story points
        ├── GenerateButton.tsx       # Button to calculate
        ├── BurndownChart.tsx        # Chart visualization
        ├── BurndownTable.tsx        # Data table
        └── QALogPanel.tsx           # Data quality issues
```

---

## 🔑 Key Concepts Explained

### Story Points
Numbers that represent **how much effort** a task takes (1, 2, 3, 5, 8, etc.). They're NOT hours — they're a team's relative estimate of complexity.

### Burndown
The **daily progress** of completing tasks. An ideal burndown is a straight line from your starting allotted points down to 0. A real burndown is usually jagged because some days more work gets done than others.

### Allotted Points
The **total story points** you set aside for the sprint (e.g., "we plan to complete 50 story points this sprint").

### Sprint
A **time-boxed period** (usually 1-2 weeks) where the team works on a set of tasks. Each sprint has a start date and end date.

### QA Flags
Data quality warnings that appear when something looks wrong:
- Task marked complete but **no completion date**
- Task marked complete but **no story points** (still counted as 0)
- Completion date **outside the sprint window**
- Task **incomplete but missing story points**

---

## 🛠️ Tech Stack (What Powers This)

- **Next.js 16.2** — Web framework (React server + routes)
- **React 19** — UI library
- **TypeScript** — Type-safe JavaScript
- **Tailwind CSS** — Styling framework
- **Recharts** — Chart library
- **Google Sheets API** — Data source
- **Node.js** — Server runtime

---

## ⚙️ Setup Instructions (For Non-Techy People)

### Prerequisites
You need these installed:
1. **Node.js** (v18+) — [download here](https://nodejs.org/)
2. **npm** or **yarn** (comes with Node.js)
3. **Google Service Account** with Sheets API access

### Step 1: Clone & Install

```bash
# Navigate to the project folder
cd c:\Python\product-dev-performance-dashboard

# Install dependencies
npm install
```

### Step 2: Set Up Google Sheets Access

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (name it whatever you want)

2. **Enable Google Sheets API**:
   - Search for "Google Sheets API"
   - Click "Enable"

3. **Create a Service Account**:
   - Go to "Service Accounts" in the console
   - Create a new service account
   - Create a **JSON key** (download it)

4. **Share your Google Sheet**:
   - Open your Asana export sheet in Google Sheets
   - Share it with the service account email (found in the JSON key file)

### Step 3: Create `.env.local` File

In the **root folder** of the project, create a file called `.env.local` and add:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@yourproject.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-sheet-id-here
GOOGLE_SHEET_RANGE=Sprints!A:W
```

**Where to find these:**
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` → in your JSON key file (`client_email`)
- `GOOGLE_PRIVATE_KEY` → in your JSON key file (`private_key`) — **copy the exact value**
- `GOOGLE_SHEET_ID` → the long ID in the sheet URL (e.g., `1x4y5z...`)
- `GOOGLE_SHEET_RANGE` → the sheet name and columns (default is fine)

### Step 4: Run the Dashboard

```bash
npm run dev
```

Open your browser to **http://localhost:3000** and you should see the burndown chart!

---

## 🎬 How to Use the Dashboard

1. **Select a Sprint** — Pick from the dropdown (shows most recent sprints first)
2. **Enter Allotted Points** — How many story points you planned for that sprint
3. **Click "Generate"** — Calculates the burndown
4. **View Results**:
   - **Chart** shows actual vs ideal progress
   - **Table** shows daily breakdowns
   - **QA Log** flags any data issues
   - **Summary** shows totals and completion %

---

## 🧪 Development

### Run in Development Mode
```bash
npm run dev
```
Changes auto-reload in your browser.

### Build for Production
```bash
npm run build
npm start
```

### Run Linter
```bash
npm run lint
```

---

## 📊 What the Calculations Do

### Daily Burndown
For each day in the sprint:
1. Count story points of tasks marked "Complete" for that day
2. Add them to previous days (cumulative)
3. Calculate remaining points (`allotted - cumulative`)
4. Compare to ideal pace (should burn evenly across the sprint)

### Example
- Sprint: 10 days, 50 points allotted
- Ideal burn per day: ~5.6 points
- Day 1: complete 3 points → remaining 47 (ideal would be 44)
- Day 2: complete 8 points → remaining 39 (ideal would be 38)
- If chart shows actual **below** ideal line = on track ✅

### QA Flags
The system checks for data quality issues and lists them so you can fix the spreadsheet:
- Missing dates on completed tasks
- Missing story points on completed tasks
- Dates outside the sprint window

---

## 🚀 Future Features (Planned)

- **Sprint Completion Rate** — What % of planned work actually got done
- **Team Capacity** — How many points each team member can handle
- **Velocity Trends** — Historical charts of sprint performance

---

## 🐛 Troubleshooting

### "Google Sheets API error"
- Check `.env.local` has the right credentials
- Make sure service account email is shared on the sheet
- Verify the sheet ID is correct

### "No sprints found"
- Make sure the Google Sheet has a "Sprints" tab
- Verify columns match what the system expects

### Chart shows no data
- Make sure tasks have completion dates and story points
- Check that status is "Complete" for the tasks you want to include

### Slow loading
- Data is cached for 60 seconds (reduces API calls)
- First load might take 5-10 seconds

---

## 📝 File Manifest (What Each File Does)

| File | Purpose |
|------|---------|
| `package.json` | Project dependencies & scripts |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript settings |
| `tailwind.config.js` | Tailwind CSS setup |
| `.env.local` | Secret API credentials (create this) |
| `src/app/page.tsx` | Home page (redirect) |
| `src/app/layout.tsx` | Main layout with sidebar |
| `src/lib/sheets.ts` | Google Sheets API connection |
| `src/lib/burndown-engine.ts` | **Core calculation logic** |
| `src/lib/row-mapper.ts` | Data transformation |
| `src/lib/date-utils.ts` | Date formatting/parsing |
| `src/types/*` | TypeScript type definitions |
| `src/components/**` | React UI components |

---

## 🎓 How to Learn More

- **Next.js Docs**: https://nextjs.org/docs
- **React Docs**: https://react.dev
- **Google Sheets API**: https://developers.google.com/sheets/api
- **Tailwind CSS**: https://tailwindcss.com

---

## 📞 Support

If something breaks:
1. Check the browser console for error messages (F12)
2. Look at the server logs in the terminal
3. Verify `.env.local` credentials are correct
4. Make sure your Google Sheet matches the expected column names
