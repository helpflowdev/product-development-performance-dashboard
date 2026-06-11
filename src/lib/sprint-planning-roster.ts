/**
 * Roster for the Sprint Planning Hours page, grouped by role.
 *
 * This is a DEDICATED roster — intentionally separate from DEV_MEMBERS in
 * `dev-members.ts`, whose list differs (it lacks Sing Li / Eric Barbosa Jr and
 * includes people not planned here). Keep the two independent.
 *
 * Matching against the sheet's "Assignee Name" is case-insensitive and trims
 * surrounding whitespace, so casing differences are tolerated.
 */

export type PlanningRole = 'QA Tester' | 'Product Specialist' | 'Developer';

export interface RosterMember {
  name: string;
  role: PlanningRole;
}

export const SPRINT_PLANNING_ROSTER: readonly RosterMember[] = [
  // QA Testers
  { name: 'JC Hsieh', role: 'QA Tester' },
  { name: 'Karim Matolo', role: 'QA Tester' },
  { name: 'Shierraine Lobederio', role: 'QA Tester' },
  // Product Specialists
  { name: 'Gio Layugan', role: 'Product Specialist' },
  { name: 'Marion Faye Alexis Quimbo', role: 'Product Specialist' },
  // Developers
  { name: 'Sing Li', role: 'Developer' },
  { name: 'Alex Fadez', role: 'Developer' },
  { name: 'Nikolay Zhidenko', role: 'Developer' },
  { name: 'Eric Barbosa Jr', role: 'Developer' },
  { name: 'Krasimir Hristozov', role: 'Developer' },
];

/** Display order for role groups on the page. */
export const ROLE_GROUP_ORDER: readonly PlanningRole[] = [
  'QA Tester',
  'Product Specialist',
  'Developer',
];

const ROSTER_BY_KEY = new Map<string, RosterMember>(
  SPRINT_PLANNING_ROSTER.map((m) => [m.name.trim().toLowerCase(), m]),
);

/**
 * Resolve a sheet "Assignee Name" to a roster member (case-insensitive, trimmed).
 * Returns null if the name is not part of the planning roster.
 */
export function resolveRosterMember(name: string | null | undefined): RosterMember | null {
  if (!name) return null;
  return ROSTER_BY_KEY.get(name.trim().toLowerCase()) ?? null;
}

// ─── Budget / break math ──────────────────────────────────────────────────────

/** A sprint is 14 days; removing the rest day leaves 10 work days × 8 h = 80 h. */
export const DEFAULT_GROSS_HOURS = 80;
export const HOURS_PER_DAY = 8;
/** 30-minute break for every 8 hours worked. */
export const BREAK_HOURS_PER_8H = 0.5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Roles that take breaks (and therefore have hours deducted). Developers do not. */
export function roleNeedsBreak(role: PlanningRole): boolean {
  return role !== 'Developer';
}

/**
 * Net "posted" budget from the gross hours a person can work this sprint.
 * Developers: fixed, no deduction. QA Testers / Product Specialists: subtract
 * a 30-min break per 8 worked hours, i.e. net = gross − (gross / 8) × 0.5.
 * (80 gross → 75 net.)
 */
export function computeNetBudget(grossHours: number, role: PlanningRole): number {
  const gross = Number.isFinite(grossHours) ? grossHours : 0;
  if (!roleNeedsBreak(role)) return round2(gross);
  const breakHours = (gross / HOURS_PER_DAY) * BREAK_HOURS_PER_8H;
  return round2(gross - breakHours);
}
