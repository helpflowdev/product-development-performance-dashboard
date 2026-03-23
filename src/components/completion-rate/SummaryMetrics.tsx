import { Card } from '@/components/ui/Card';
import { CompletionRateSummary } from '@/types/completion-rate';

interface SummaryMetricsProps {
  summary: CompletionRateSummary;
  assigneeLabel?: string;
}

function getRateColor(rate: number): string {
  if (rate >= 80) return 'bg-green-50 border-green-200 text-green-900';
  if (rate >= 60) return 'bg-yellow-50 border-yellow-200 text-yellow-900';
  return 'bg-red-50 border-red-200 text-red-900';
}

export function SummaryMetrics({ summary, assigneeLabel }: SummaryMetricsProps) {
  const rateColor = getRateColor(summary.completionRate);

  return (
    <Card className="mb-6">
      {assigneeLabel && <p className="text-sm text-gray-600 mb-4">For assignee: {assigneeLabel}</p>}
      <div className="grid grid-cols-3 gap-6">
        {/* Total Tasks */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-600">Total Tasks</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{summary.totalTasks}</p>
        </div>

        {/* Completed Tasks */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm font-medium text-blue-600">Completed Tasks</p>
          <p className="text-4xl font-bold text-blue-900 mt-2">{summary.totalCompleted}</p>
        </div>

        {/* Completion Rate */}
        <div className={`border rounded-lg p-6 ${rateColor}`}>
          <p className="text-sm font-medium">Completion Rate</p>
          <p className="text-4xl font-bold mt-2">{summary.completionRate.toFixed(2)}%</p>
        </div>
      </div>
    </Card>
  );
}
