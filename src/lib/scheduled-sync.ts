import { fetchAsanaProjects, searchWorkspaceProjects } from '@/lib/asana';
import { syncSprintData } from '@/lib/sync-engine';
import { todayInTimezone, toDateString } from '@/lib/date-utils';

/**
 * Scheduled sync — keeps the sheet current without anyone clicking Sync.
 * Before this, the sheet only changed on a manual sync, so the burndown
 * silently showed whatever was synced last (on 2026-11-23 that was Sunday
 * ~9:30 PM, hiding all of Monday's completions).
 *
 *   current  — the sprint whose date range contains today (team timezone).
 *   previous — the sprint that ended most recently, for PREVIOUS_GRACE_DAYS
 *              after its end, so late completions still land in its numbers.
 *
 * The schedule lives in .github/workflows/scheduled-sync.yml (GitHub Actions —
 * the Vercel plan only allows daily crons). When CRON_SECRET is set, callers
 * must send "Authorization: Bearer <secret>"; anyone else gets 401.
 */
export type ScheduledTarget = 'current' | 'previous';

const PREVIOUS_GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "Sprint #2026.Q4.S4 (1119-1202)" → year, quarter, start MMDD, end MMDD. */
const SPRINT_NAME_RE = /^Sprint #(\d{4})\.Q(\d)\.S\d+.*?\((\d{2})(\d{2})-(\d{2})(\d{2})\)/;

export interface SprintWindow {
  name: string;
  start: Date; // local midnight, comparable with todayInTimezone()
  end: Date;
}

/**
 * Read a sprint's date range from its name. Handles sprints that straddle New
 * Year: a Q1 sprint starting in Oct–Dec started the previous year, and an end
 * month earlier than the start month falls in the following year.
 */
export function parseSprintWindow(name: string): SprintWindow | null {
  const m = name.trim().match(SPRINT_NAME_RE);
  if (!m) return null;
  const [year, quarter, sm, sd, em, ed] = m.slice(1).map(Number);
  if (sm < 1 || sm > 12 || em < 1 || em > 12) return null;

  const startYear = quarter === 1 && sm >= 10 ? year - 1 : year;
  const endYear = em < sm ? startYear + 1 : startYear;
  return {
    name: name.trim(),
    start: new Date(startYear, sm - 1, sd),
    end: new Date(endYear, em - 1, ed),
  };
}

/** Pick the sprint to sync for `target`, or null when there is none. */
export function pickSprint(
  windows: SprintWindow[],
  today: Date,
  target: ScheduledTarget,
): SprintWindow | null {
  if (target === 'current') {
    const active = windows.filter((w) => w.start <= today && today <= w.end);
    active.sort((a, b) => b.start.getTime() - a.start.getTime());
    return active[0] ?? null;
  }

  const ended = windows.filter((w) => w.end < today);
  ended.sort((a, b) => b.end.getTime() - a.end.getTime());
  const last = ended[0];
  if (!last) return null;
  const daysSinceEnd = Math.round((today.getTime() - last.end.getTime()) / DAY_MS);
  return daysSinceEnd <= PREVIOUS_GRACE_DAYS ? last : null;
}

function toWindows(names: string[]): SprintWindow[] {
  const seen = new Set<string>();
  const windows: SprintWindow[] = [];
  for (const name of names) {
    const w = parseSprintWindow(name);
    if (w && !seen.has(w.name)) {
      seen.add(w.name);
      windows.push(w);
    }
  }
  return windows;
}

/**
 * Find the sprint to sync. Looks in the (dept) Development team first; for the
 * current sprint it falls back to a workspace-wide search, because a brand-new
 * sprint is often created outside the team — syncSprintData then moves it in.
 */
export async function resolveScheduledSprint(
  target: ScheduledTarget,
  today: Date,
  log: (message: string) => void,
): Promise<SprintWindow | null> {
  const teamProjects = await fetchAsanaProjects();
  const picked = pickSprint(toWindows(teamProjects.map((p) => p.name)), today, target);
  if (picked || target !== 'current') return picked;

  const quarter = Math.floor(today.getMonth() / 3) + 1;
  const query = `Sprint #${today.getFullYear()}.Q${quarter}`;
  log(`No current sprint in the Development team — searching the workspace for "${query}"...`);
  const found = await searchWorkspaceProjects(query, 100);
  return pickSprint(toWindows(found.map((p) => p.name)), today, target);
}

/** Shared GET handler for the /api/cron/sync-*-sprint routes. */
export async function handleScheduledSync(
  request: Request,
  target: ScheduledTarget,
): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(message);
    console.log(`[cron:${target}] ${message}`);
  };

  try {
    const today = todayInTimezone();
    const sprint = await resolveScheduledSprint(target, today, log);
    if (!sprint) {
      const reason =
        target === 'current'
          ? `no sprint covers ${toDateString(today)}`
          : `no sprint ended in the last ${PREVIOUS_GRACE_DAYS} days`;
      log(`Nothing to sync: ${reason}.`);
      return Response.json({ target, skipped: true, reason, logs });
    }

    log(`Syncing ${sprint.name}`);
    const result = await syncSprintData(sprint.name, log, 'scheduled');

    // Another sync holding the lock isn't a failure — the sheet is being
    // refreshed either way, and the next scheduled run picks up from there.
    if (result.lockBusy) {
      return Response.json({ target, skipped: true, reason: result.error, logs });
    }
    return Response.json({ target, ...result, logs }, { status: result.success ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error: ${message}`);
    return Response.json({ target, success: false, error: message, logs }, { status: 500 });
  }
}
