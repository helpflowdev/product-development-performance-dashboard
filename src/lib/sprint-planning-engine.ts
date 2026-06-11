import { SprintRow } from '@/types/sprint';
import { SprintPlanningMemberStat } from '@/types/sprint-planning';
import {
  RosterMember,
  ROLE_GROUP_ORDER,
  resolveRosterMember,
} from './sprint-planning-roster';
import { filterBySprints } from './completion-rate-engine';

/**
 * Parse a numeric cell (hours or story points) that may be blank, a dash, or
 * contain stray characters. Returns 0 when nothing numeric is present.
 */
function parseNum(raw: string | undefined | null): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isComplete(row: SprintRow): boolean {
  return row.status?.trim() === 'Complete';
}

/**
 * Compute per-member hours stats for a single sprint.
 *
 * Groups the sprint's rows by roster member (case-insensitive name match),
 * ignoring assignees not in the planning roster. Only members with ≥1 task are
 * returned. All tasks count — including recurring (DT/WT/ST) ones, since they
 * still consume hours.
 *
 * Result order: role group (QA Tester → Product Specialist → Developer), then
 * alphabetical by name within each group.
 */
export function computeSprintPlanning(
  rows: SprintRow[],
  sprintId: string,
): SprintPlanningMemberStat[] {
  const sprintRows = filterBySprints(rows, [sprintId]);
  if (sprintRows.length === 0) return [];

  type Bucket = {
    member: RosterMember;
    taskCount: number;
    assignedHours: number;
    completedHours: number;
    assignedStoryPoints: number;
    actualStoryPoints: number;
  };
  const buckets = new Map<string, Bucket>(); // keyed by canonical roster name

  for (const row of sprintRows) {
    const member = resolveRosterMember(row.assigneeName);
    if (!member) continue; // assignee not in the planning roster

    let bucket = buckets.get(member.name);
    if (!bucket) {
      bucket = {
        member,
        taskCount: 0,
        assignedHours: 0,
        completedHours: 0,
        assignedStoryPoints: 0,
        actualStoryPoints: 0,
      };
      buckets.set(member.name, bucket);
    }

    const complete = isComplete(row);
    bucket.taskCount += 1;
    bucket.assignedHours += parseNum(row.hoursEstimate);
    bucket.assignedStoryPoints += parseNum(row.storyPoints);
    if (complete) {
      bucket.completedHours += parseNum(row.hoursActual);
      bucket.actualStoryPoints += parseNum(row.storyPoints);
    }
  }

  const stats: SprintPlanningMemberStat[] = [];
  for (const b of buckets.values()) {
    const assignedHours = round2(b.assignedHours);
    const completedHours = round2(b.completedHours);
    stats.push({
      assigneeName: b.member.name,
      role: b.member.role,
      taskCount: b.taskCount,
      assignedHours,
      completedHours,
      remainingHours: round2(assignedHours - completedHours),
      assignedStoryPoints: round2(b.assignedStoryPoints),
      actualStoryPoints: round2(b.actualStoryPoints),
    });
  }

  // Sort by role group order, then alphabetically within the group.
  const roleRank = new Map(ROLE_GROUP_ORDER.map((r, i) => [r, i]));
  stats.sort((a, b) => {
    const rankDiff = (roleRank.get(a.role) ?? 99) - (roleRank.get(b.role) ?? 99);
    if (rankDiff !== 0) return rankDiff;
    return a.assigneeName.localeCompare(b.assigneeName);
  });

  return stats;
}
