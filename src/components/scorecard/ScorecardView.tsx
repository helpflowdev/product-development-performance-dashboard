'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatHours } from '@/lib/format';
import { ScorecardResponse } from '@/types/scorecard';
import { AssigneeTaskGroup } from '@/types/sprint-summary';

interface ScorecardViewProps {
  scorecard: ScorecardResponse;
}

/** One stat tile, with an optional sub-line under the value. */
function MetricTile({
  label,
  value,
  sub,
  valueClass = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card className="text-center">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

function countTasks(groups: AssigneeTaskGroup[]): number {
  return groups.reduce((sum, g) => sum + g.tasks.length, 0);
}

/** Collapsible list: tasks grouped per assignee, each a hyperlinked title. */
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
 * Renders a computed Weekly Scorecard for review before sending to Asana. Shows
 * the leadership metrics (completion this-sprint vs QTD, devs vs team, story-
 * point burndown) plus the Sprint-Summary-derived detail the team asked to pull
 * in: estimation accuracy (hours), per-assignee breakdown, spillover, and
 * task-level traceability. The editable uptime note and analytical narrative
 * live on the page above this.
 */
export function ScorecardView({ scorecard: sc }: ScorecardViewProps) {
  const meetsGoal = sc.completionRate >= sc.completionGoal;
  const hoursVariance = sc.totalHoursActual - sc.totalHoursEstimate;
  const accuracy =
    sc.totalHoursEstimate > 0
      ? `Actual/Est: ${((sc.totalHoursActual / sc.totalHoursEstimate) * 100).toFixed(1)}%`
      : undefined;

  return (
    <div className="space-y-4">
      {/* Sprint + date range */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-white">{sc.sprintId}</h3>
          <span className="text-sm text-slate-400">{sc.dateRange}</span>
        </div>
      </Card>

      {/* Completion rate tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Completion — This Sprint"
          value={`${sc.completionRate.toFixed(2)}%`}
          sub={`Goal: ${sc.completionGoal}% ${meetsGoal ? '✓' : '✗'}`}
          valueClass={meetsGoal ? 'text-emerald-400' : 'text-amber-400'}
        />
        <MetricTile
          label="Completion — QTD"
          value={sc.qtdCompletionRate !== null ? `${sc.qtdCompletionRate.toFixed(2)}%` : '—'}
        />
        <MetricTile label="Devs" value={`${sc.devsCompletionRate.toFixed(2)}%`} />
        <MetricTile
          label="Product Development Team"
          value={`${sc.teamCompletionRate.toFixed(2)}%`}
        />
      </div>

      {/* Tasks + burndown tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Tasks (Completed / Total)"
          value={`${sc.totalCompleted} / ${sc.totalTasks}`}
        />
        <MetricTile label="Allotted Story Points" value={`${sc.allottedStoryPoints}`} />
        <MetricTile label="Consumed Story Points" value={`${sc.consumedStoryPoints}`} />
        <MetricTile label="Burndown Rate" value={`${sc.burndownRate.toFixed(2)}%`} />
      </div>

      {/* Hours (estimation accuracy) + spillover */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Est / Actual Hours"
          value={`${formatHours(sc.totalHoursEstimate)} / ${formatHours(sc.totalHoursActual)}`}
        />
        <MetricTile
          label="Hours Variance"
          value={`${hoursVariance >= 0 ? '+' : ''}${formatHours(hoursVariance)}`}
          sub={accuracy}
          valueClass={hoursVariance <= 0 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <MetricTile label="Carried Over" value={`${sc.carriedOverCount}`} />
        <MetricTile label="Assignees" value={`${sc.assignees.length}`} />
      </div>

      <p className="text-xs text-slate-500">
        <span className="text-slate-400">This Sprint / QTD</span> use the Status
        column (same source as the Completion Rate page).{' '}
        <span className="text-slate-400">Devs</span> = rows with role Developer
        (falls back to the dev roster when roles are blank).{' '}
        <span className="text-slate-400">Burndown Rate</span> = consumed ÷ allotted
        story points (matches the Burndown page). Per-assignee, hours, carried-over,
        and the task lists below are pulled from the Sprint Summary, whose
        &ldquo;completed&rdquo; excludes tasks carried into the next sprint.
      </p>

      {/* Per-assignee breakdown (from the Sprint Summary) */}
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
              {sc.assignees.map((a) => {
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
                        : `${formatHours(a.hoursActual)} (${formatHours(a.hoursEstimate)})`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Task-level traceability (from the Sprint Summary) */}
      <GroupedTaskList
        title="Completed Tasks"
        groups={sc.completedTasks}
        accent="text-emerald-400"
      />
      <GroupedTaskList
        title="Carried Over to Next Sprint"
        groups={sc.carriedOverTasks}
        accent="text-amber-400"
        defaultOpen
      />
      {sc.incompleteTasks.length > 0 && (
        <GroupedTaskList
          title="Incomplete (Not Carried Over)"
          groups={sc.incompleteTasks}
          accent="text-rose-400"
          defaultOpen
        />
      )}
    </div>
  );
}
