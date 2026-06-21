'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SprintSummaryResponse } from '@/types/sprint-summary';

interface SprintSummaryViewProps {
  summary: SprintSummaryResponse;
}

/** One stat tile in the top row. */
function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </Card>
  );
}

/** Collapsible list of task URLs. */
function TaskUrlList({
  title,
  urls,
  accent,
  defaultOpen = false,
}: {
  title: string;
  urls: string[];
  accent: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-semibold text-white">
          {title} <span className={accent}>({urls.length})</span>
        </span>
        <svg
          className={`w-4 h-4 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          {urls.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {urls.map((url, i) => (
                <li key={`${url}-${i}`} className="flex gap-2">
                  <span className="text-slate-500 w-6 shrink-0 text-right">{i + 1}.</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 hover:text-cyan-200 hover:underline break-all"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Renders a computed Sprint Summary on the page (Burndown-style layout) so it
 * can be reviewed before sending to Asana.
 */
export function SprintSummaryView({ summary }: SprintSummaryViewProps) {
  return (
    <div className="space-y-6">
      {summary.warning && (
        <Card className="border border-yellow-500/40 bg-yellow-500/10">
          <p className="text-sm text-yellow-300">⚠️ {summary.warning}</p>
        </Card>
      )}

      {/* Metric tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile
          label="Total Tasks"
          value={`${summary.completedTasks} (${summary.totalTasks})`}
        />
        <MetricTile
          label="Completion Rate"
          value={`${summary.completionRate.toFixed(2)}%`}
        />
        <MetricTile
          label="Est / Actual Hours"
          value={`${summary.totalHoursEstimate.toFixed(2)} / ${summary.totalHoursActual.toFixed(2)}`}
        />
      </div>

      {/* Per-assignee breakdown */}
      <Card>
        <h3 className="font-semibold text-white mb-4">Per-Assignee Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-4 font-medium">Assignee</th>
                <th className="py-2 pr-4 font-medium">Completed vs Total</th>
                <th className="py-2 font-medium">Actual (Est) Hours</th>
              </tr>
            </thead>
            <tbody>
              {summary.assignees.map((a) => {
                const noHours = a.hoursEstimate === 0 && a.hoursActual === 0;
                return (
                  <tr key={a.name} className="border-b border-white/5 last:border-b-0">
                    <td className="py-2 pr-4 text-slate-100 font-medium">{a.name}</td>
                    <td className="py-2 pr-4 text-slate-300">
                      {a.completionRate.toFixed(2)}% ({a.completed}/{a.total})
                    </td>
                    <td className="py-2 text-slate-300">
                      {noHours
                        ? '—'
                        : `${Math.ceil(a.hoursActual)} (${Math.ceil(a.hoursEstimate)})`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Task lists */}
      <TaskUrlList
        title="Completed Tasks"
        urls={summary.completedTaskUrls}
        accent="text-emerald-400"
        defaultOpen
      />
      <TaskUrlList
        title="Transferred Tasks"
        urls={summary.transferredTaskUrls}
        accent="text-amber-400"
      />
      <TaskUrlList
        title={
          summary.nextSprintName
            ? `Next Sprint Tasks — ${summary.nextSprintName}`
            : 'Next Sprint Tasks'
        }
        urls={summary.nextSprintTaskUrls}
        accent="text-cyan-400"
      />
    </div>
  );
}
