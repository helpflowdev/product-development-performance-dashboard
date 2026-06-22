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
} from 'recharts';
import { BurndownDay } from '@/types/burndown';

/**
 * Build a label renderer for chart dots showing the value on EVERY point.
 * `position` offsets the label clear of the bullet so the two lines'
 * labels don't overlap: the upper (actual) line labels sit above their dots,
 * the lower (ideal) line labels sit below theirs.
 */
function makeLabelRenderer(color: string, position: 'above' | 'below') {
  const dy = position === 'above' ? -16 : 20;
  return function LabelRenderer(props: any) {
    const { x, y, value } = props;
    if (typeof value !== 'number') return null;
    return (
      <text
        x={x}
        y={y + dy}
        fill={color}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
      >
        {Math.round(value)}
      </text>
    );
  };
}

interface BurndownChartProps {
  data: BurndownDay[];
  allottedPoints: number;
  sprintId?: string;
}

export function BurndownChart({ data, allottedPoints, sprintId }: BurndownChartProps) {
  if (data.length === 0) {
    return <div className="text-center text-slate-300 py-8">No data to display</div>;
  }

  // Let the actual-remaining line dip below zero when the sprint over-delivers
  // (consumed > allotted). Keep 0 as the floor otherwise so the axis isn't
  // needlessly stretched. Floor to a sensible step so the axis ticks stay round.
  const minActual = data.reduce(
    (min, d) =>
      typeof d.actualRemainingSP === 'number' && d.actualRemainingSP < min
        ? d.actualRemainingSP
        : min,
    0,
  );
  const step = allottedPoints >= 500 ? 50 : allottedPoints >= 100 ? 20 : 5;
  const yMin = minActual < 0 ? Math.floor(minActual / step) * step : 0;

  return (
    <div className="w-full glass-card rounded-xl p-6">
      {sprintId && (
        <h3 className="text-center text-lg font-bold text-cyan-300 mb-4">{sprintId}</h3>
      )}
      <div style={{ width: '100%', height: 550 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 40, right: 30, left: 60, bottom: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1b4b" />
            <XAxis
              dataKey="displayDate"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              interval={Math.max(0, Math.floor(data.length / 12))}
            />
            <YAxis
              domain={[yMin, allottedPoints]}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              label={{
                value: 'Story Points',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#94a3b8' },
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
                backgroundColor: 'rgba(15, 12, 41, 0.92)',
                border: '1px solid rgba(99, 102, 241, 0.5)',
                borderRadius: '8px',
                color: '#f8fafc',
                padding: '8px',
              }}
              labelStyle={{ color: '#f8fafc' }}
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
              label={makeLabelRenderer('#ea8c55', 'below')}
              isAnimationActive={false}
            />
            {/* Actual Remaining Line (solid, cyan) — stops at today */}
            <Line
              type="monotone"
              dataKey="actualRemainingSP"
              stroke="#06b6d4"
              strokeWidth={2.5}
              name="Actual Remaining"
              dot={{ fill: '#06b6d4', r: 3.5 }}
              label={makeLabelRenderer('#06b6d4', 'above')}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
