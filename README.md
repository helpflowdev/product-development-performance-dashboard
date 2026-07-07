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
# GEMINI_MODEL=<model>                # optional; auto-discovered otherwise

# Misc
TIMEZONE=America/Los_Angeles          # used for Asana due dates + report headers
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
