import { SprintCompletionStat } from '@/types/completion-rate';

interface SprintStatsProps {
  sprint: SprintCompletionStat;
}

function getRateColor(rate: number): string {
  if (rate >= 80) return 'bg-green-50 border-green-200 text-green-900';
  if (rate >= 60) return 'bg-yellow-50 border-yellow-200 text-yellow-900';
  return 'bg-red-50 border-red-200 text-red-900';
}

export function SprintStats({ sprint }: SprintStatsProps) {
  const rateColor = getRateColor(sprint.completionRate);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-700 text-sm">{sprint.sprintId}</h3>

      <div className="space-y-3">
        {/* Total Tasks */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600">Total Tasks</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{sprint.total}</p>
        </div>

        {/* Completed Tasks */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-medium text-blue-600">Completed Tasks</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{sprint.completed}</p>
        </div>

        {/* Completion Rate */}
        <div className={`border rounded-lg p-4 ${rateColor}`}>
          <p className="text-xs font-medium">Completion Rate</p>
          <p className="text-2xl font-bold mt-1">{sprint.completionRate.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}
