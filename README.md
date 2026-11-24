This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment variables

Set these in `.env.local` (all optional unless noted — sensible code defaults are used when unset).

```bash
# Asana (required for the sync + report writers)
ASANA_ACCESS_TOKEN=<pat>              # Asana personal access token
ASANA_TEAM_ID=<gid>                   # "(dept) Development" team
# ASANA_WORKSPACE_ID=<gid>            # optional; derived from the team if unset

# Sprint Summary → Asana (posts as a subtask under a standing parent task)
ASANA_SUMMARY_PARENT_TASK_ID=1216367392606773   # "DEV - End of Sprint Summary"
ASANA_SUMMARY_ASSIGNEE_ID=1166606777471938       # Shann Bryle Rubido
# Note: ASANA_SUMMARY_PROJECT_ID is no longer used — the summary now posts under
# the parent task above, not into a project.

# Weekly Scorecard → Asana (posts as a subtask under a standing parent task)
ASANA_SCORECARD_PARENT_TASK_ID=1207376779108203  # "Dev - Weekly Scorecard Report"
ASANA_SCORECARD_ASSIGNEE_ID=<user gid>            # scorecard owner (optional)
# SCORECARD_COMPLETION_GOAL stays a code default (95); no env needed.

# AI narrative / focus summary (optional — features degrade gracefully without it)
GEMINI_API_KEY=<key>
# GEMINI_MODEL=<model>                # optional; leave unset unless forcing one model

# Misc
TIMEZONE=Etc/GMT+8                   # PST (UTC-8, no DST; the sign is inverted in Etc/ names) — Asana dates, report headers, burndown 'today'

# Scheduled sync (recommended)
CRON_SECRET=<random string>          # Vercel sends it on cron calls; other callers of /api/cron/* get 401
```

## Asana → sheet sync

The dashboards read the Google Sheet, which only changes when a sync runs:

- **Scheduled (Vercel Cron, see `vercel.json`)** — every 3 hours the current sprint
  (the one whose dates contain today, PST) is synced; every 6 hours the sprint
  that just ended is synced too, for 7 days after its end date, so late
  completions still count. Crons run on production deployments only.
- **Manual** — the Sync page, for any sprint, any time.

Both use the same sync and share a run lock, so a scheduled run and a manual click
can't rewrite the sheet at the same time (the second one is told to retry). The
lock and each sprint's last successful sync time live in a **Sync Log** tab the sync
creates on first run. The burndown shows that date and time (and whether it was
scheduled or manual) above the chart, and turns it amber once it's over 4 hours
old, so a missed sync shows instead of looking like missing work.

Only tasks that are members of the sprint project are synced. A subtask under a
sprint task isn't synced unless it is also added to the sprint project itself.

### Gemini model selection

Leave `GEMINI_MODEL` unset in normal operation. The app asks the API which models
the key can use, prefers known-good free-tier `flash` models, and falls through to
the next candidate when one returns 429 (quota), 403/404 (no access) or a 5xx —
up to four attempts. Free-tier quota is per **Google Cloud project**, not per key,
so issuing a new key in the same project does not reset an exhausted quota.

Set `GEMINI_MODEL` only to force one specific model. That pin is strict: discovery
and fallback are skipped, so if the pinned model is out of quota the summary fails
rather than trying another. When a summary does fail, the UI now shows the
`quotaId`, its limit and the retry delay — a limit of `0` means that model has no
free-tier allowance at all (pick another), while a non-zero limit means the day's
requests are genuinely used up (resets at midnight Pacific).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
