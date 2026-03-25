# Architecture & Component Deep Dive

## 🏛️ Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER (Frontend)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React Components (src/components/)                      │   │
│  │  - BurndownPage (main)                                   │   │
│  │  - SprintSelector, AllottedPointsSelect                 │   │
│  │  - BurndownChart (Recharts), BurndownTable              │   │
│  │  - QALogPanel                                            │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                             │
│                     │ HTTP Requests (JSON)                        │
│                     ↓                                             │
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ GET /api/sprints (fetch list)
                      │ POST /api/burndown (calculate)
                      │
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Backend - Node.js)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Routes (src/app/api/)                               │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ GET /api/sprints                                     │ │   │
│  │  │ - Calls fetchSheetRows()                             │ │   │
│  │  │ - Calls mapRowsToSprintRows()                        │ │   │
│  │  │ - Calls getUniqueSprints()                           │ │   │
│  │  │ - Returns: { sprints: SprintMeta[] }                 │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ POST /api/burndown                                   │ │   │
│  │  │ - Validates request (sprintId, allottedPoints)      │ │   │
│  │  │ - Calls fetchSheetRows()                             │ │   │
│  │  │ - Filters to selected sprint                         │ │   │
│  │  │ - Calls computeBurndown()                            │ │   │
│  │  │ - Returns: { days, qaFlags, totalConsumedPoints... } │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                             │
│                     │ Uses                                        │
│                     ↓                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Business Logic (src/lib/)                               │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ sheets.ts: fetchSheetRows()                        │  │   │
│  │  │ - Initializes Google auth                          │  │   │
│  │  │ - Fetches values from sheet                        │  │   │
│  │  │ - Caches for 60 seconds                            │  │   │
│  │  │ Returns: string[][]  (raw 2D array)                │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ row-mapper.ts: mapRowsToSprintRows()               │  │   │
│  │  │ - Builds column name → index map from header       │  │   │
│  │  │ - Validates all required columns exist             │  │   │
│  │  │ - Converts each row to typed SprintRow object      │  │   │
│  │  │ Returns: SprintRow[]                               │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ burndown-engine.ts: Core Logic                     │  │   │
│  │  │                                                    │  │   │
│  │  │ getUniqueSprints(rows)                            │  │   │
│  │  │ - Extracts sprint names & dates                   │  │   │
│  │  │ - Sorts reverse-chronologically                   │  │   │
│  │  │ Returns: SprintMeta[]                             │  │   │
│  │  │                                                    │  │   │
│  │  │ computeBurndown(rows, allottedPoints)             │  │   │
│  │  │ 1. Validates sprint dates exist                   │  │   │
│  │  │ 2. Calculates ideal daily burn rate               │  │   │
│  │  │ 3. For each day in sprint:                        │  │   │
│  │  │    - Count completed story points                 │  │   │
│  │  │    - Compare to ideal pace                        │  │   │
│  │  │    - Flag data issues (QA)                        │  │   │
│  │  │ 4. Returns: { days[], qaFlags[], totals... }      │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ date-utils.ts: Helpers                            │  │   │
│  │  │ - parseDate(str) → Date                           │  │   │
│  │  │ - toDateString(Date) → "YYYY-MM-DD"              │  │   │
│  │  │ - formatDisplayDate(Date) → "Mar 12"             │  │   │
│  │  │ - daysBetween(d1, d2) → number                    │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                             │
│                     │ Reads from                                  │
│                     ↓                                             │
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ Google Sheets API
                      │
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Services                        │
│  - Google Sheets API (read task data)                          │
│  - Service Account Auth                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### 1. **API Routes** (`src/app/api/`)

#### `GET /api/sprints`
**Purpose**: Fetch list of available sprints for the dropdown

**Input**: None (query params optional)

**Process**:
```javascript
fetchSheetRows()              // Get raw data from Google Sheets
  → mapRowsToSprintRows()     // Convert to SprintRow objects
  → getUniqueSprints()        // Extract unique sprint names
  → Sort by date (newest first)
  → Return SprintListResponse
```

**Output**:
```json
{
  "sprints": [
    {
      "id": "Sprint #2025.Q1.S1 (0108-0121)",
      "startDate": "2025-01-08",
      "endDate": "2025-01-21"
    }
  ]
}
```

---

#### `POST /api/burndown`
**Purpose**: Calculate burndown for a selected sprint

**Input**:
```json
{
  "sprintId": "Sprint #2025.Q1.S1 (0108-0121)",
  "allottedPoints": 50
}
```

**Validation**:
- ✓ sprintId is not empty
- ✓ allottedPoints is a positive number
- ✓ Sprint exists in data

**Process**:
```javascript
fetchSheetRows()                        // Get raw sheet
  → mapRowsToSprintRows()               // Convert to typed objects
  → Filter rows by sprintId             // Get only this sprint's tasks
  → computeBurndown(rows, points)       // Core calculation
  → Return BurndownResponse
```

**Output**:
```json
{
  "sprintId": "Sprint #2025.Q1.S1",
  "allottedPoints": 50,
  "totalConsumedPoints": 48,
  "burndownRate": "96.00%",
  "days": [
    {
      "date": "2025-01-08",
      "displayDate": "Jan 08",
      "dailyCompletedSP": 3,
      "cumulativeCompletedSP": 3,
      "actualRemainingSP": 47,
      "idealRemainingSP": 44
    }
    // ... more days
  ],
  "qaFlags": [
    {
      "type": "complete_missing_story_points",
      "taskTitle": "Fix login bug",
      "assignee": "John"
    }
  ],
  "computedAt": "2025-03-18T14:30:22.123Z"
}
```

---

### 2. **Business Logic** (`src/lib/`)

#### `sheets.ts` - Google Sheets Connection

**Key Functions**:

```typescript
fetchSheetRows(): Promise<string[][]>
```
- **What**: Connects to Google Sheets API and fetches raw data
- **Caching**: 60-second TTL to avoid quota hits (60 reads/minute limit)
- **Auth**: Uses Google Service Account (credentials in `.env.local`)
- **Returns**: 2D string array (each row is an array of cell values)

```typescript
invalidateSheetCache(): void
```
- **What**: Manually clear the cache (for testing)

---

#### `row-mapper.ts` - Data Transformation

**Key Functions**:

```typescript
mapRowsToSprintRows(rawRows: string[][]): SprintRow[]
```

**What it does**:
1. Takes raw 2D array from Google Sheets
2. Reads the header row (first row)
3. Builds a column name → index mapping
4. For each data row:
   - Validates it's not empty
   - Extracts cell values by column name
   - Creates a `SprintRow` object
5. Returns array of typed objects

**Why this way**: Column-name based (not index-based) means the sheet can be rearranged and still work.

---

#### `burndown-engine.ts` - Core Calculation

**Key Functions**:

```typescript
getUniqueSprints(rows: SprintRow[]): SprintMeta[]
```
- Extracts unique sprint IDs with their start/end dates
- Sorts descending (newest first)
- Returns dropdown list

---

```typescript
computeBurndown(sprintRows: SprintRow[], allottedPoints: number): Omit<BurndownResponse, 'sprintId' | 'computedAt'>
```

**The heart of the system.** Here's what it does:

1. **Parse Sprint Dates**
   - Extract start & end dates from first row
   - Calculate total sprint days

2. **Calculate Ideal Burn Rate**
   ```
   idealDailyBurn = allottedPoints / (totalSprintDays - 1)
   ```
   (Dividing by days-1 because burn happens across the period)

3. **Build Daily Completion Map**
   - For each task in the sprint:
     - If status is NOT "Complete": skip (or flag if missing points)
     - If status IS "Complete":
       - Get completion date (priority: `dateCompletedForBurndown` → `dateCompleted`)
       - If no date: flag as QA issue
       - If date outside sprint: flag as QA issue (but still count it)
       - If no story points: flag as QA issue (count as 0)
       - Add story points to that day's bucket

4. **Generate Daily Series**
   - For each day in sprint:
     - Sum story points completed on that day
     - Add to cumulative total
     - Calculate remaining points
     - Calculate ideal remaining based on ideal burn rate
     - Store all in `BurndownDay` object

5. **Calculate Burndown Rate**
   ```
   burndownRate = (totalConsumedPoints / allottedPoints) * 100
   ```

---

#### `date-utils.ts` - Date Helpers

```typescript
parseDate(str: string): Date | null
```
- Handles multiple date formats (MM/DD/YYYY, M/D/YYYY, etc.)
- Returns null if unparseable
- Sets time to midnight (00:00:00)

```typescript
toDateString(date: Date): string
```
- Converts to "YYYY-MM-DD" format
- Used for consistent date keys

```typescript
formatDisplayDate(date: Date): string
```
- Converts to human-readable "Mar 12" format
- Used in charts

```typescript
daysBetween(d1: Date, d2: Date): number
```
- Returns number of days between two dates

```typescript
isDateBefore(d1: Date, d2: Date): boolean
isDateAfter(d1: Date, d2: Date): boolean
```
- Comparison helpers

---

### 3. **React Components** (`src/components/`)

#### Layout Components

**`Sidebar.tsx`**
- Left navigation sidebar
- Links to Burndown Chart and Completion Rate pages
- Shows current page highlight
- Dark theme (slate-800)

---

#### Burndown Page Components

**`SprintSelector.tsx`**
```tsx
<SprintSelector
  sprints={sprints}           // List from API
  selectedSprint={selected}   // Current selection
  onSprintChange={setSelected}// Update handler
  disabled={loading}          // Disable while loading
/>
```
- Dropdown to pick a sprint
- Auto-selects newest sprint on load
- Disabled while calculating

---

**`AllottedPointsSelect.tsx`**
```tsx
<AllottedPointsSelect
  selectedPoints={points}
  onPointsChange={setPoints}
  disabled={loading}
/>
```
- Number input for story points
- Values: 20, 30, 40, 50, 60, 80
- User can also type custom value

---

**`GenerateButton.tsx`**
- Button that triggers the POST /api/burndown call
- Shows loading spinner while computing
- Disabled until sprint and points are selected

---

**`BurndownChart.tsx`**
- Uses Recharts library for visualization
- X-axis: dates (displayDate, e.g., "Jan 08")
- Y-axis: remaining story points
- Two lines:
  - **Actual line**: Real progress (blue)
  - **Ideal line**: What should happen (green)
- Tooltips show daily details on hover

---

**`BurndownTable.tsx`**
- Displays daily breakdown in table format
- Columns:
  - Date (displayDate)
  - Daily Completed
  - Cumulative Completed
  - Actual Remaining
  - Ideal Remaining
- Sortable/filterable (future enhancement)

---

**`QALogPanel.tsx`**
- Shows data quality issues
- Flag types:
  - 🔴 `complete_missing_date` - Task marked done but no date
  - 🟡 `complete_missing_story_points` - Done but no points (counted as 0)
  - 🟡 `date_outside_sprint` - Completion date outside sprint window
  - 🟡 `incomplete_missing_story_points` - Not done and no points

---

#### UI Components (Reusable)

**`Card.tsx`**
- White container with padding
- Used for all main content sections
- Props: className (optional)

**`Badge.tsx`**
- Small label component
- Used for status indicators
- Props: label, color

**`LoadingSpinner.tsx`**
- Animated spinner while computing
- Shown while API request is in progress

---

### 4. **Type Definitions** (`src/types/`)

#### `sprint.ts`
```typescript
interface SprintRow {
  sprint: string                      // e.g., "Sprint #2025.Q1.S1"
  sprintDateStart: string             // MM/DD/YYYY
  sprintDateEnd: string               // MM/DD/YYYY
  tasksTitle: string                  // Task name
  assigneeName: string                // Who's assigned
  storyPoints: string                 // Effort estimate
  status: string                      // "Complete" or "Incomplete"
  dateCompleted: string               // MM/DD/YYYY
  dateCompletedForBurndown: string    // PRIMARY date for burndown
  // ... 13 more fields
}

interface SprintMeta {
  id: string                          // Sprint name
  startDate: string                   // YYYY-MM-DD (normalized)
  endDate: string                     // YYYY-MM-DD (normalized)
}
```

#### `burndown.ts`
```typescript
interface BurndownDay {
  date: string                        // YYYY-MM-DD
  displayDate: string                 // "Mar 12"
  dailyCompletedSP: number
  cumulativeCompletedSP: number
  actualRemainingSP: number
  idealRemainingSP: number
}

interface BurndownResponse {
  sprintId: string
  allottedPoints: number
  days: BurndownDay[]
  qaFlags: QAFlag[]
  totalConsumedPoints: number
  burndownRate: string               // "96.00%"
  computedAt: string                 // ISO timestamp
}
```

---

## 🔄 Data Flow Example

**User interaction:**
1. User selects "Sprint #2025.Q1.S1" and enters "50" points
2. User clicks "Generate"

**Frontend:**
```javascript
fetch('/api/burndown', {
  method: 'POST',
  body: JSON.stringify({
    sprintId: 'Sprint #2025.Q1.S1',
    allottedPoints: 50
  })
})
```

**Backend:**
```javascript
// 1. Fetch data
const rawRows = await fetchSheetRows()
// Returns: [['Sprint', 'Date', ...], ['Sprint #2025...', '01/08/2025', ...], ...]

// 2. Convert to typed data
const sprintRows = mapRowsToSprintRows(rawRows)
// Returns: [
//   { sprint: 'Sprint #2025.Q1.S1', sprintDateStart: '01/08/2025', ... },
//   ...
// ]

// 3. Filter
const filtered = sprintRows.filter(r => r.sprint === 'Sprint #2025.Q1.S1')

// 4. Calculate
const result = computeBurndown(filtered, 50)
// Loops through each day:
//   Day 1 (Jan 8): task 1 & 2 done → 8 points
//   Day 2 (Jan 9): task 3 done → 3 points
//   ...

// 5. Return
return {
  sprintId: 'Sprint #2025.Q1.S1',
  allottedPoints: 50,
  days: [{
    date: '2025-01-08',
    displayDate: 'Jan 08',
    dailyCompletedSP: 8,
    actualRemainingSP: 42,
    idealRemainingSP: 44
  }, ...],
  qaFlags: [...],
  totalConsumedPoints: 48,
  burndownRate: '96.00%',
  computedAt: '2025-03-18T...'
}
```

**Frontend receives response and updates state:**
```javascript
setBurndownData(result)
```

**React re-renders with:**
- BurndownChart (draws two lines)
- BurndownTable (shows daily details)
- Summary stats (total points, rate)
- QA log (flags issues)

---

## 🎯 Design Patterns Used

### 1. **Column-Name Resilience**
Instead of using column indices (fragile), the system builds a name→index map. If columns are rearranged, it still works.

### 2. **Graceful Degradation**
Missing data doesn't break the calculation:
- Missing story points? Count as 0
- Missing date? Flag as QA issue but keep going
- Missing a sprint? Return error

### 3. **60-Second Cache**
Google Sheets API has a quota limit. Caching raw data for 60 seconds reduces API calls without staleness.

### 4. **Type Safety**
Everything is typed (TypeScript). Raw strings become typed `SprintRow` objects early on.

### 5. **Separation of Concerns**
- **sheets.ts**: "Get data"
- **row-mapper.ts**: "Shape data"
- **burndown-engine.ts**: "Compute metrics"
- **Components**: "Show results"

---

## 🚀 Extension Points (Easy to Add)

### Add a New Metric
Add calculation to `computeBurndown()` and return in `BurndownResponse`

### Add a New Page
Create `src/app/newpage/page.tsx` and add to sidebar

### Add a New API Endpoint
Create `src/app/api/newroute/route.ts`

### Change Chart Type
Swap Recharts components in `BurndownChart.tsx`

---

## ⚠️ Known Limitations

1. **No user authentication** — Everyone sees all sprints (assumes trusted internal use)
2. **Read-only** — Can't modify data from dashboard
3. **60-second cache** — Data can be up to a minute old
4. **No historical storage** — Each calculation is fresh (no trend analysis)
5. **Single sheet source** — Can't read multiple Google Sheets
6. **No pagination** — If sheet has 10,000+ rows, may slow down

---

## 🧪 Testing Insights

To test the API manually:
```bash
# Test GET sprints
curl http://localhost:3000/api/sprints

# Test POST burndown
curl -X POST http://localhost:3000/api/burndown \
  -H "Content-Type: application/json" \
  -d '{"sprintId":"Sprint #2025.Q1.S1","allottedPoints":50}'
```

To test components locally:
- Edit `src/app/burndown/page.tsx` directly
- Changes auto-reload
- Use browser DevTools (F12) to inspect state

