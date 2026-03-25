'use client';

import { useState } from 'react';
import { AssigneeCompletionStat } from '@/types/individual-cr';

interface IndividualCRTableProps {
  stats: AssigneeCompletionStat[];
  selectedSprintIds: string[];
}

type SortColumn = 'assignee' | 'role' | 'total' | 'completed' | 'rate';
type SortDirection = 'asc' | 'desc';

export function IndividualCRTable({ stats, selectedSprintIds }: IndividualCRTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn>('assignee');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const multiSprint = selectedSprintIds.length > 1;

  // Sort stats
  const sortedStats = [...stats].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortCol) {
      case 'assignee':
        aVal = a.assigneeName;
        bVal = b.assigneeName;
        break;
      case 'role':
        aVal = a.role;
        bVal = b.role;
        break;
      case 'total':
        aVal = a.total;
        bVal = b.total;
        break;
      case 'completed':
        aVal = a.completed;
        bVal = b.completed;
        break;
      case 'rate':
        aVal = a.completionRate;
        bVal = b.completionRate;
        break;
    }

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    }

    return sortDir === 'asc' ? comparison : -comparison;
  });

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const getRateColor = (rate: number): string => {
    return rate >= 90
      ? 'text-emerald-400 font-semibold bg-emerald-400/10 rounded'
      : 'text-rose-400 font-semibold bg-rose-400/10 rounded';
  };

  const toggleExpand = (assigneeName: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(assigneeName)) {
      newExpanded.delete(assigneeName);
    } else {
      newExpanded.add(assigneeName);
    }
    setExpandedRows(newExpanded);
  };

  const SortHeader = ({ col, label }: { col: SortColumn; label: string }) => (
    <th
      className="px-4 py-3 text-left text-sm font-semibold text-cyan-300 cursor-pointer hover:bg-white/10 transition-colors"
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-2">
        {label}
        {sortCol === col && (
          <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-white/5 border-b border-white/10">
            {multiSprint && <th className="w-12 px-4 py-3"></th>}
            <SortHeader col="assignee" label="Assignee Name" />
            <SortHeader col="total" label="Total Tasks" />
            <SortHeader col="completed" label="Completed Tasks" />
            <SortHeader col="rate" label="Completion Rate" />
          </tr>
        </thead>
        <tbody>
          {sortedStats.flatMap((stat) => {
            const rows: React.ReactNode[] = [];

            // Main row
            rows.push(
              <tr key={stat.assigneeName} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                {multiSprint && (
                  <td className="px-4 py-3 text-center">
                    {stat.bySprint.length > 0 && (
                      <button
                        onClick={() => toggleExpand(stat.assigneeName)}
                        className="text-slate-300 hover:text-cyan-300 font-bold transition-colors"
                      >
                        {expandedRows.has(stat.assigneeName) ? '▼' : '▶'}
                      </button>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-white font-medium">
                  {stat.assigneeName}
                </td>
                <td className="px-4 py-3 text-sm text-slate-200">{stat.total}</td>
                <td className="px-4 py-3 text-sm text-slate-200">{stat.completed}</td>
                <td className={`px-4 py-3 text-sm rounded ${getRateColor(stat.completionRate)}`}>
                  {stat.completionRate.toFixed(2)}%
                </td>
              </tr>
            );

            // Expanded sub-rows: per-sprint breakdown
            if (multiSprint && expandedRows.has(stat.assigneeName)) {
              for (const sprintStat of stat.bySprint) {
                rows.push(
                  <tr
                    key={`${stat.assigneeName}-${sprintStat.sprintId}`}
                    className="border-b border-white/5 bg-white/3 hover:bg-white/8 transition-colors"
                  >
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-sm text-slate-300 italic pl-12">
                      {sprintStat.sprintId}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{sprintStat.total}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{sprintStat.completed}</td>
                    <td className={`px-4 py-3 text-sm rounded ${getRateColor(sprintStat.completionRate)}`}>
                      {sprintStat.completionRate.toFixed(2)}%
                    </td>
                  </tr>
                );
              }
            }

            return rows;
          })}
        </tbody>
      </table>
    </div>
  );
}
