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
      ? 'text-green-700 font-semibold bg-green-50'
      : 'text-red-700 font-semibold bg-red-50';
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
      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
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
          <tr className="bg-gray-50 border-b border-gray-200">
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
              <tr key={stat.assigneeName} className="border-b border-gray-200 hover:bg-gray-50">
                {multiSprint && (
                  <td className="px-4 py-3 text-center">
                    {stat.bySprint.length > 0 && (
                      <button
                        onClick={() => toggleExpand(stat.assigneeName)}
                        className="text-gray-600 hover:text-gray-900 font-bold"
                      >
                        {expandedRows.has(stat.assigneeName) ? '▼' : '▶'}
                      </button>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                  {stat.assigneeName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{stat.total}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{stat.completed}</td>
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
                    className="border-b border-gray-100 bg-gray-50 hover:bg-gray-100"
                  >
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-sm text-gray-600 italic pl-12">
                      {sprintStat.sprintId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sprintStat.total}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{sprintStat.completed}</td>
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
