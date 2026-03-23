'use client';

import { BurndownDay } from '@/types/burndown';

interface BurndownTableProps {
  data: BurndownDay[];
}

export function BurndownTable({ data }: BurndownTableProps) {
  return (
    <details className="mt-6 border border-gray-200 rounded-lg p-4">
      <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
        View Daily Breakdown ({data.length} days)
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-blue-50 border-b border-blue-200">
              <th className="px-4 py-3 text-left font-semibold text-blue-900">Date</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-900">Daily SP</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-900">Cumulative SP</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-900">Actual Remaining</th>
              <th className="px-4 py-3 text-right font-semibold text-blue-900">Ideal Remaining</th>
            </tr>
          </thead>
          <tbody>
            {data.map((day, idx) => (
              <tr key={day.date} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 hover:bg-blue-50'}>
                <td className="px-4 py-2 border-b border-gray-200 text-gray-900 font-medium">{day.displayDate}</td>
                <td className="px-4 py-2 border-b border-gray-200 text-right text-gray-700">{day.dailyCompletedSP}</td>
                <td className="px-4 py-2 border-b border-gray-200 text-right text-gray-700">{day.cumulativeCompletedSP}</td>
                <td className="px-4 py-2 border-b border-gray-200 text-right font-semibold text-blue-600">{day.actualRemainingSP}</td>
                <td className="px-4 py-2 border-b border-gray-200 text-right text-amber-600 font-medium">{day.idealRemainingSP}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
