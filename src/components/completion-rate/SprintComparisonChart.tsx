'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { CompareSprintsResponse } from '@/types/completion-rate';

interface SprintComparisonChartProps {
  data: CompareSprintsResponse | null;
  loading: boolean;
}

function extractSprintLabel(sprintId: string): string {
  // Extract date range from sprint ID, e.g., "Sprint #2025.Q1.S1 (0108-0121)" -> "S1 (0108-0121)"
  const match = sprintId.match(/S\d+\s*\([^)]+\)/);
  return match ? match[0] : sprintId.slice(0, 30);
}

const COLORS = ['#3b82f6', '#ef4444']; // Blue and Red

export function SprintComparisonChart({ data, loading }: SprintComparisonChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!data || data.sprints.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <p>Select two sprints and click Compare to see the comparison chart.</p>
      </div>
    );
  }

  const [sprintA, sprintB] = data.sprints;

  const chartData = [
    {
      label: sprintA.week || extractSprintLabel(sprintA.sprintId),
      rate: sprintA.completionRate,
      fullId: sprintA.sprintId,
      index: 0,
    },
    {
      label: sprintB.week || extractSprintLabel(sprintB.sprintId),
      rate: sprintB.completionRate,
      fullId: sprintB.sprintId,
      index: 1,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 180, right: 60, top: 20, bottom: 20 }}
      >
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <YAxis
          type="category"
          dataKey="label"
          width={170}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => (typeof value === 'number' ? `${value.toFixed(2)}%` : value)}
          contentStyle={{
            backgroundColor: '#f3f4f6',
            border: '2px solid #3b82f6',
            borderRadius: '6px',
            color: '#000',
            padding: '8px 12px',
          }}
          labelStyle={{ color: '#000' }}
        />
        <Bar dataKey="rate" barSize={50} radius={[0, 12, 12, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[entry.index]} />
          ))}
          <LabelList
            dataKey="rate"
            position="insideRight"
            offset={12}
            formatter={(value) => (typeof value === 'number' ? `${value.toFixed(2)}%` : value)}
            fill="#ffffff"
            fontSize={13}
            fontWeight={600}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
