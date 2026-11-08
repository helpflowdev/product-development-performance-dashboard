'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatHours } from '@/lib/format';
import { AssigneeTaskGroup, SprintSummaryResponse } from '@/types/sprint-summary';

interface SprintSummaryViewProps {
  summary: SprintSummaryResponse;
}

/** One stat tile in the top row, with an optional sub-line under the value. */
function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="text-center">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

/** Total task count across all assignee groups. */
function countTasks(groups: AssigneeTaskGroup[]): number {
  return groups.reduce((sum, g) => sum + g.tasks.length, 0);
}

/**
 * Collapsible list section: tasks grouped per assignee, each task a hyperlinked
 * title under a "Name (count):" heading.
 */
function GroupedTaskList({
  title,
  groups,
  accent,
  defaultOpen = false,
}: {
  title: string;
  groups: AssigneeTaskGroup[];
  accent: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total = countTasks(groups);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-semibold text-white">
          {title} <span className={accent}>({total})</span>
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
        // Scroll long lists inside the box so the page stays compact.
        <div className="list-scroll mt-3 max-h-64 overflow-y-auto pr-2 space-y-3">
          {total === 0 ? (
            <p className="text-sm text-slate-500">No tasks.</p>
          ) : (
            groups.map((group) => (
              <div key={group.assignee}>
                <p className="text-sm font-semibold text-slate-200 mb-0.5">
                  {group.assignee}{' '}
                  <span className="text-slate-400 font-normal">({group.tasks.length})</span>
                </p>
                <ol className="space-y-0.5 text-sm list-decimal list-inside marker:text-slate-500">
                  {group.tasks.map((task, i) => (
                    <li key={`${task.url || task.title}-${i}`} className="text-slate-300">
                      {task.url ? (
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 hover:text-cyan-200 hover:underline"
                        >
                          {task.title}
                        </a>
                      ) : (
                        task.title
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))
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
    <div className="space-y-4">
      {summary.warning && (
        <Card className="border border-yellow-500/40 bg-yellow-500/10">
          <p className="text-sm text-yellow-300">⚠️ {summary.warning}</p>
        </Card>
      )}

      {/* Metric tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile label="Completed Tasks" value={`${summary.completedCount}`} />
        <MetricTile
          label="Plotted Tasks"
          value={`${summary.plottedCount}`}
          sub={
            summary.midSprintCount > 0
              ? `+${summary.midSprintCount} mid-sprint, not counted`
              : undefined
          }
        />
        <MetricTile label="Completion Rate" value={`${summary.completionRate.toFixed(2)}%`} />
        <MetricTile
          label="Est / Actual Hours"
          value={`${formatHours(summary.totalHoursEstimate)} / ${formatHours(summary.totalHoursActual)}`}
        />
      </div>

      {/* Story points + trend */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricTile
          label="Story Points (Done / Plotted)"
          value={`${formatHours(summary.totalStoryPointsCompleted)} / ${formatHours(summary.totalStoryPointsPlotted)}`}
        />
        <MetricTile
          label="SP Burndown Rate"
          value={`${summary.storyPointBurndownRate.toFixed(2)}%`}
        />
        <MetricTile
          label="Completion QTD"
          value={
            summary.qtdCompletionRate !== null
              ? `${summary.qtdCompletionRate.toFixed(2)}%`
              : '—'
          }
        />
      </div>

      {/* Definitions note */}
      <p className="text-xs text-slate-500">
        <span className="text-slate-400">Completed</span> = finished and not carried
        to the next sprint. <span className="text-slate-400">Carried Over</span> =
        added to the next sprint (any status).{' '}
        <span className="text-slate-400">Plotted</span> = all tasks in this sprint,
        including recurring (DT)/(WT)/(ST)
        {summary.midSprintCount > 0 ? (
          <>
            , except <span className="text-slate-400">mid-sprint additions</span>{' '}
            (titles ending in &ldquo;(mid sprint)&rdquo;). Those are listed separately
            and left out of every count and completion rate here, QTD included; hours
            and story points still include them.
          </>
        ) : (
          '.'
        )}
      </p>

      {/* Per-assignee breakdown */}
      <Card>
        <h3 className="font-semibold text-white mb-4">Per-Assignee Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/10">
                <th className="py-2 pr-4 font-medium">Assignee</th>
                <th className="py-2 pr-4 font-medium">Completed vs Plotted</th>
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
                      {a.total > 0
                        ? `${a.completionRate.toFixed(2)}% (${a.completed}/${a.total})`
                        : '— (mid-sprint additions only)'}
                    </td>
                    <td className="py-2 text-slate-300">
                      {noHours
                        ? '—'
                        : `${formatHours(a.hoursActual)} (${formatHours(a.hoursEstimate)})`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Task lists */}
      <GroupedTaskList
        title="Completed Tasks"
        groups={summary.completedTasks}
        accent="text-emerald-400"
        defaultOpen
      />
      <GroupedTaskList
        title="Carried Over to Next Sprint"
        groups={summary.carriedOverTasks}
        accent="text-amber-400"
        defaultOpen
      />
      {summary.incompleteCount > 0 && (
        <GroupedTaskList
          title="Incomplete (Not Carried Over)"
          groups={summary.incompleteTasks}
          accent="text-rose-400"
          defaultOpen
        />
      )}
      {summary.midSprintCount > 0 && (
        <GroupedTaskList
          title={`Mid-Sprint Additions — not counted (${summary.midSprintCompletedCount} complete)`}
          groups={summary.midSprintTasks}
          accent="text-violet-400"
          defaultOpen
        />
      )}
      <GroupedTaskList
        title={
          summary.nextSprintName
            ? `Next Sprint Tasks — ${summary.nextSprintName}`
            : 'Next Sprint Tasks'
        }
        groups={summary.nextSprintTasks}
        accent="text-cyan-400"
        defaultOpen
      />
    </div>
  );
}
