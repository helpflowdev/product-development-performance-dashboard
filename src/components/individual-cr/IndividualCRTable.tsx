'use client';

import { useState } from 'react';
import { AssigneeCompletionStat } from '@/types/individual-cr';

interface IndividualCRTableProps {
  stats: AssigneeCompletionStat[];
}

type SortColumn = 'assignee' | 'role' | 'total' | 'completed' | 'rate';
type SortDirection = 'asc' | 'desc';

export function IndividualCRTable({ stats }: IndividualCRTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn>('assignee');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [expandedAssignees, setExpandedAssignees] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

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

  const toggleAssignee = (name: string) => {
    const next = new Set(expandedAssignees);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedAssignees(next);
  };

  const toggleMonth = (key: string) => {
    const next = new Set(expandedMonths);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedMonths(next);
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
            <SortHeader col="assignee" label="Assignee Name" />
            <SortHeader col="total" label="Total Tasks" />
            <SortHeader col="completed" label="Completed Tasks" />
            <SortHeader col="rate" label="Completion Rate" />
          </tr>
        </thead>
        <tbody>
          {sortedStats.flatMap((stat) => {
            const rows: React.ReactNode[] = [];
            const canExpandAssignee = stat.byMonth.length > 0;
            const isAssigneeExpanded = expandedAssignees.has(stat.assigneeName);

            // Assignee row (level 0)
            rows.push(
              <tr
                key={stat.assigneeName}
                onClick={canExpandAssignee ? () => toggleAssignee(stat.assigneeName) : undefined}
                className={`border-b border-white/10 transition-colors ${
                  canExpandAssignee ? 'cursor-pointer hover:bg-white/5' : ''
                }`}
              >
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

            if (!canExpandAssignee || !isAssigneeExpanded) return rows;

            // Month rows (level 1) and Sprint rows (level 2)
            for (const month of stat.byMonth) {
              const monthKey = `${stat.assigneeName}|${month.monthKey}`;
              const canExpandMonth = month.sprints.length > 0;
              const isMonthExpanded = expandedMonths.has(monthKey);

              rows.push(
                <tr
                  key={monthKey}
                  onClick={canExpandMonth ? () => toggleMonth(monthKey) : undefined}
                  className={`border-b border-white/5 bg-white/[0.03] transition-colors ${
                    canExpandMonth ? 'cursor-pointer hover:bg-white/[0.07]' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-slate-200 pl-8">
                    {month.monthLabel}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-200">{month.total}</td>
                  <td className="px-4 py-3 text-sm text-slate-200">{month.completed}</td>
                  <td className={`px-4 py-3 text-sm rounded ${getRateColor(month.completionRate)}`}>
                    {month.completionRate.toFixed(2)}%
                  </td>
                </tr>
              );

              if (!canExpandMonth || !isMonthExpanded) continue;

              for (const sprint of month.sprints) {
                rows.push(
                  <tr
                    key={`${monthKey}|${sprint.sprintId}`}
                    className="border-b border-white/5 bg-white/[0.05] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-slate-300 italic pl-16">
                      {sprint.sprintId}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{sprint.total}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{sprint.completed}</td>
                    <td className={`px-4 py-3 text-sm rounded ${getRateColor(sprint.completionRate)}`}>
                      {sprint.completionRate.toFixed(2)}%
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
