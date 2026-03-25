import { SprintCompletionStat } from '@/types/completion-rate';

interface SprintStatsProps {
  sprint: SprintCompletionStat;
}

function getRateColor(rate: number): string {
  if (rate >= 80) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  if (rate >= 60) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
}

export function SprintStats({ sprint }: SprintStatsProps) {
  const rateColor = getRateColor(sprint.completionRate);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-200 text-sm">{sprint.sprintId}</h3>

      <div className="space-y-3">
        {/* Total Tasks */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-300">Total Tasks</p>
          <p className="text-2xl font-bold text-white mt-1">{sprint.total}</p>
        </div>

        {/* Completed Tasks */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
          <p className="text-xs font-medium text-cyan-400">Completed Tasks</p>
          <p className="text-2xl font-bold text-cyan-100 mt-1">{sprint.completed}</p>
        </div>

        {/* Completion Rate */}
        <div className={`border rounded-xl p-4 ${rateColor}`}>
          <p className="text-xs font-medium">Completion Rate</p>
          <p className="text-2xl font-bold mt-1">{sprint.completionRate.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}
