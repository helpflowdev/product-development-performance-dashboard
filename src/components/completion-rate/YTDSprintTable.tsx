import { Card } from '@/components/ui/Card';
import { SprintCompletionStat } from '@/types/completion-rate';

interface YTDSprintTableProps {
  sprints: SprintCompletionStat[];
  groupByMonth?: boolean;
}

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_ABBR = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getRateColor(rate: number): string {
  if (rate >= 80) return 'text-emerald-400 font-semibold bg-emerald-400/10 rounded';
  if (rate >= 60) return 'text-amber-400 font-semibold bg-amber-400/10 rounded';
  return 'text-rose-400 font-semibold bg-rose-400/10 rounded';
}

function formatDateRange(start: string, end: string): string {
  const startParts = start.split('-');
  const endParts = end.split('-');
  const startMonth = parseInt(startParts[1], 10);
  const startDay = parseInt(startParts[2], 10);
  const endMonth = parseInt(endParts[1], 10);
  const endDay = parseInt(endParts[2], 10);
  const endYear = parseInt(endParts[0], 10);
  return `${MONTH_ABBR[startMonth]} ${startDay} - ${MONTH_ABBR[endMonth]} ${endDay}, ${endYear}`;
}

/**
 * Determine the (year, month) bucket containing the majority of days in the
 * sprint's date range. Mirrors the server-side logic in `sprint-primary-month.ts`
 * so the grouped display lines up with the API's filter results.
 * Tiebreaker: later month wins.
 */
function getPrimaryYearMonth(
  isoStart: string,
  isoEnd: string
): { year: number; month: number } | null {
  const [sy, sm, sd] = isoStart.split('-').map((p) => parseInt(p, 10));
  const [ey, em, ed] = isoEnd.split('-').map((p) => parseInt(p, 10));
  if ([sy, sm, sd, ey, em, ed].some((n) => Number.isNaN(n))) return null;
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (end < start) return null;

  type Bucket = { year: number; month: number; days: number };
  const counts = new Map<string, Bucket>();
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const key = `${y}-${m}`;
    const existing = counts.get(key);
    if (existing) existing.days += 1;
    else counts.set(key, { year: y, month: m, days: 1 });
    cursor.setDate(cursor.getDate() + 1);
  }

  let best: Bucket | null = null;
  for (const b of counts.values()) {
    if (!best) {
      best = b;
      continue;
    }
    if (b.days > best.days) best = b;
    else if (
      b.days === best.days &&
      (b.year > best.year || (b.year === best.year && b.month > best.month))
    ) {
      best = b;
    }
  }
  return best ? { year: best.year, month: best.month } : null;
}

interface MonthGroup {
  key: string;
  label: string;
  total: number;
  completed: number;
  completionRate: number;
  sprints: SprintCompletionStat[];
}

function buildMonthGroups(sprints: SprintCompletionStat[]): MonthGroup[] {
  const groupMap = new Map<string, MonthGroup>();
  const orphans: SprintCompletionStat[] = [];

  for (const sprint of sprints) {
    const primary = getPrimaryYearMonth(sprint.sprintStartDate, sprint.sprintEndDate);
    if (!primary) {
      orphans.push(sprint);
      continue;
    }
    const key = `${primary.year}-${String(primary.month).padStart(2, '0')}`;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        label: `${MONTH_NAMES[primary.month]} ${primary.year}`,
        total: 0,
        completed: 0,
        completionRate: 0,
        sprints: [],
      };
      groupMap.set(key, group);
    }
    group.total += sprint.total;
    group.completed += sprint.completed;
    group.sprints.push(sprint);
  }

  const groups = Array.from(groupMap.values());
  for (const g of groups) {
    g.completionRate =
      g.total > 0 ? Math.round((g.completed / g.total) * 10000) / 100 : 0;
    g.sprints.sort((a, b) => a.sprintStartDate.localeCompare(b.sprintStartDate));
  }
  groups.sort((a, b) => a.key.localeCompare(b.key));

  if (orphans.length > 0) {
    const total = orphans.reduce((s, x) => s + x.total, 0);
    const completed = orphans.reduce((s, x) => s + x.completed, 0);
    groups.push({
      key: 'unknown',
      label: 'Unknown',
      total,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
      sprints: orphans,
    });
  }

  return groups;
}

export function YTDSprintTable({ sprints, groupByMonth = false }: YTDSprintTableProps) {
  if (sprints.length === 0) {
    return (
      <Card className="mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Sprint Summary</h2>
        <p className="text-slate-300">No sprint data available for the selected filters.</p>
      </Card>
    );
  }

  const groups = groupByMonth ? buildMonthGroups(sprints) : [];

  return (
    <Card className="mb-6">
      <h2 className="text-xl font-bold text-white mb-4">Sprint Summary</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">
                {groupByMonth ? 'Month / Sprint' : 'Sprint'}
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">Period</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-cyan-300">Total Tasks</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-cyan-300">Completed Tasks</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-cyan-300">Completion Rate</th>
            </tr>
          </thead>
          <tbody>
            {!groupByMonth &&
              sprints.map((sprint, idx) => (
                <tr key={sprint.sprintId} className={idx % 2 === 0 ? 'bg-transparent' : 'bg-white/3'}>
                  <td className="px-4 py-3 text-sm text-slate-200 border-b border-white/10">
                    {sprint.sprintId}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 border-b border-white/10">
                    {formatDateRange(sprint.sprintStartDate, sprint.sprintEndDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-slate-200 border-b border-white/10">
                    {sprint.total}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-slate-200 border-b border-white/10">
                    {sprint.completed}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-center border-b border-white/10 ${getRateColor(
                      sprint.completionRate
                    )}`}
                  >
                    {sprint.completionRate.toFixed(2)}%
                  </td>
                </tr>
              ))}

            {groupByMonth &&
              groups.flatMap((group) => {
                const rows: React.ReactNode[] = [];

                rows.push(
                  <tr
                    key={group.key}
                    className="border-b border-white/10 bg-white/[0.06]"
                  >
                    <td className="px-4 py-3 text-sm text-white font-semibold">{group.label}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {group.sprints.length} sprint{group.sprints.length === 1 ? '' : 's'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-200 font-semibold">
                      {group.total}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-200 font-semibold">
                      {group.completed}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm text-center ${getRateColor(group.completionRate)}`}
                    >
                      {group.completionRate.toFixed(2)}%
                    </td>
                  </tr>
                );

                for (const sprint of group.sprints) {
                  rows.push(
                    <tr
                      key={`${group.key}|${sprint.sprintId}`}
                      className="border-b border-white/5"
                    >
                      <td className="px-4 py-3 text-sm text-slate-300 pl-12">{sprint.sprintId}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {formatDateRange(sprint.sprintStartDate, sprint.sprintEndDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-slate-300">{sprint.total}</td>
                      <td className="px-4 py-3 text-sm text-center text-slate-300">{sprint.completed}</td>
                      <td
                        className={`px-4 py-3 text-sm text-center ${getRateColor(sprint.completionRate)}`}
                      >
                        {sprint.completionRate.toFixed(2)}%
                      </td>
                    </tr>
                  );
                }

                return rows;
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
