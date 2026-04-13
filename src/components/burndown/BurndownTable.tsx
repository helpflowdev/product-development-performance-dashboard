'use client';

import { BurndownDay } from '@/types/burndown';

interface BurndownTableProps {
  data: BurndownDay[];
}

export function BurndownTable({ data }: BurndownTableProps) {
  return (
    <details className="mt-6 border border-white/20 rounded-lg p-4 glass-card">
      <summary className="cursor-pointer font-semibold text-slate-200 hover:text-white transition-colors">
        View Daily Breakdown ({data.length} days)
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left font-semibold text-cyan-300">Date</th>
              <th className="px-4 py-3 text-right font-semibold text-cyan-300">Daily SP</th>
              <th className="px-4 py-3 text-right font-semibold text-cyan-300">Cumulative SP</th>
              <th className="px-4 py-3 text-right font-semibold text-cyan-300">Actual Remaining</th>
              <th className="px-4 py-3 text-right font-semibold text-cyan-300">Ideal Remaining</th>
            </tr>
          </thead>
          <tbody>
            {data.map((day, idx) => (
              <tr key={day.date} className={idx % 2 === 0 ? 'bg-transparent hover:bg-white/5' : 'bg-white/3 hover:bg-white/8'}>
                <td className="px-4 py-2 border-b border-white/10 text-slate-100 font-medium">{day.displayDate}</td>
                <td className="px-4 py-2 border-b border-white/10 text-right text-slate-200">{day.dailyCompletedSP}</td>
                <td className="px-4 py-2 border-b border-white/10 text-right text-slate-200">{day.cumulativeCompletedSP}</td>
                <td className="px-4 py-2 border-b border-white/10 text-right font-semibold text-cyan-400">{day.actualRemainingSP ?? '—'}</td>
                <td className="px-4 py-2 border-b border-white/10 text-right text-amber-400 font-medium">{day.idealRemainingSP}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
