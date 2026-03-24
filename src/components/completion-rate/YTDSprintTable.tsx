import { Card } from '@/components/ui/Card';
import { SprintCompletionStat } from '@/types/completion-rate';

interface YTDSprintTableProps {
  sprints: SprintCompletionStat[];
}

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

  const months = [
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

  return `${months[startMonth - 1]} ${startDay} - ${months[endMonth - 1]} ${endDay}, ${endYear}`;
}

export function YTDSprintTable({ sprints }: YTDSprintTableProps) {
  if (sprints.length === 0) {
    return (
      <Card className="mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Sprint Summary</h2>
        <p className="text-slate-300">No sprint data available for the selected filters.</p>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <h2 className="text-xl font-bold text-white mb-4">Sprint Summary</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">Sprint</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">Period</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-cyan-300">Total Tasks</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-cyan-300">Completed Tasks</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-cyan-300">Completion Rate</th>
            </tr>
          </thead>
          <tbody>
            {sprints.map((sprint, idx) => (
              <tr
                key={idx}
                className={idx % 2 === 0 ? 'bg-transparent' : 'bg-white/3'}
              >
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
                <td className={`px-4 py-3 text-sm text-center border-b border-white/10 ${getRateColor(sprint.completionRate)}`}>
                  {sprint.completionRate.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
