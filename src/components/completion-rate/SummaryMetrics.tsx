import { Card } from '@/components/ui/Card';
import { CompletionRateSummary } from '@/types/completion-rate';

interface SummaryMetricsProps {
  summary: CompletionRateSummary;
  assigneeLabel?: string;
}

function getRateColor(rate: number): string {
  if (rate >= 80) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  if (rate >= 60) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
}

export function SummaryMetrics({ summary, assigneeLabel }: SummaryMetricsProps) {
  const rateColor = getRateColor(summary.completionRate);

  return (
    <Card className="mb-6">
      {assigneeLabel && <p className="text-sm text-slate-300 mb-4">For assignee: {assigneeLabel}</p>}
      <div className="grid grid-cols-3 gap-6">
        {/* Total Tasks */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <p className="text-sm font-medium text-slate-300">Total Tasks</p>
          <p className="text-4xl font-bold text-white mt-2">{summary.totalTasks}</p>
        </div>

        {/* Completed Tasks */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6">
          <p className="text-sm font-medium text-cyan-400">Completed Tasks</p>
          <p className="text-4xl font-bold text-cyan-100 mt-2">{summary.totalCompleted}</p>
        </div>

        {/* Completion Rate */}
        <div className={`border rounded-xl p-6 ${rateColor}`}>
          <p className="text-sm font-medium">Completion Rate</p>
          <p className="text-4xl font-bold mt-2">{summary.completionRate.toFixed(2)}%</p>
        </div>
      </div>
    </Card>
  );
}
