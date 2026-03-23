'use client';

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { BurndownDay } from '@/types/burndown';

/**
 * Custom label renderer for chart dots showing the value
 * Shows labels on every other data point to avoid clutter
 */
function renderCustomLabel(props: any) {
  const { x, y, value, index } = props;

  // Only show label if it's a defined number
  if (typeof value !== 'number') return null;

  // Show label only on every other dot to reduce clutter
  if (index % 2 !== 0) return null;

  return (
    <text
      x={x}
      y={y - 15}
      fill="#374151"
      textAnchor="middle"
      fontSize={12}
      fontWeight={600}
    >
      {Math.round(value)}
    </text>
  );
}

interface BurndownChartProps {
  data: BurndownDay[];
  allottedPoints: number;
}

export function BurndownChart({ data, allottedPoints }: BurndownChartProps) {
  if (data.length === 0) {
    return <div className="text-center text-gray-500 py-8">No data to display</div>;
  }

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Burndown Trend</h2>
      <div style={{ width: '100%', height: 550 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 40, right: 30, left: 60, bottom: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="displayDate"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12, fill: '#374151' }}
              interval={Math.max(0, Math.floor(data.length / 12))}
            />
            <YAxis
              domain={[0, allottedPoints]}
              tick={{ fontSize: 12, fill: '#374151' }}
              label={{
                value: 'Story Points',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#374151' },
              }}
            />
            <Tooltip
              formatter={(value) => {
                if (typeof value === 'number') {
                  return value % 1 === 0 ? value : value.toFixed(2);
                }
                return value;
              }}
              labelFormatter={(label) => `${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px',
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
            {/* Ideal Burn Line (dashed, orange) */}
            <Line
              type="monotone"
              dataKey="idealRemainingSP"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeDasharray="8 4"
              name="Ideal Burn"
              dot={{ fill: '#f59e0b', r: 3.5 }}
              label={(props: any) => {
                const { x, y, value, index } = props;
                if (typeof value !== 'number' || index % 2 !== 0) return null;
                return (
                  <text x={x} y={y - 15} fill="#ea8c55" textAnchor="middle" fontSize={11} fontWeight={500}>
                    {Math.round(value)}
                  </text>
                );
              }}
              isAnimationActive={false}
            />
            {/* Actual Remaining Line (solid, blue) */}
            <Line
              type="monotone"
              dataKey="actualRemainingSP"
              stroke="#3b82f6"
              strokeWidth={2.5}
              name="Actual Remaining"
              dot={{ fill: '#3b82f6', r: 3.5 }}
              label={(props: any) => {
                const { x, y, value, index } = props;
                if (typeof value !== 'number' || index % 2 !== 0) return null;
                return (
                  <text x={x} y={y + 15} fill="#2563eb" textAnchor="middle" fontSize={11} fontWeight={500}>
                    {Math.round(value)}
                  </text>
                );
              }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
