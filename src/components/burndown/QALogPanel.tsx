'use client';

import { QAFlag, QAFlagType } from '@/types/burndown';
import { Badge } from '@/components/ui/Badge';

/** Describes how each QA flag group is titled, colored, and exported. */
interface SectionDef {
  type: QAFlagType;
  title: string;
  color: string; // tailwind text color for the section heading
  severity: 'error' | 'warning' | 'info';
  extraHeader?: string; // optional 4th column header
  extraValue?: (f: QAFlag) => string; // value for that column / CSV detail
}

const SECTIONS: SectionDef[] = [
  {
    type: 'complete_missing_date',
    title: 'Complete but missing burndown date',
    color: 'text-rose-400',
    severity: 'error',
  },
  {
    type: 'complete_missing_story_points',
    title: 'Complete but missing story points',
    color: 'text-cyan-400',
    severity: 'info',
  },
  {
    type: 'date_outside_sprint',
    title: 'Date outside sprint window',
    color: 'text-amber-400',
    severity: 'warning',
    extraHeader: 'Completed',
    extraValue: (f) => f.date ?? '',
  },
  {
    type: 'incomplete_missing_story_points',
    title: 'Incomplete missing story points',
    color: 'text-cyan-400',
    severity: 'info',
  },
  {
    type: 'task_added_mid_sprint',
    title: 'Tasks added mid-sprint',
    color: 'text-amber-400',
    severity: 'warning',
    extraHeader: 'Date Added to Sprint',
    extraValue: (f) => f.dateAddedToSprint ?? '',
  },
  {
    type: 'task_in_multiple_sprints',
    title: 'Tasks added to multiple sprints',
    color: 'text-violet-400',
    severity: 'info',
    extraHeader: 'Other Sprints',
    extraValue: (f) => (f.sprints ?? []).join('; '),
  },
];

// --- CSV helpers ---
function csvCell(value: string): string {
  const v = value ?? '';
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function buildCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((cols) => cols.map(csvCell).join(',')).join('\r\n');
}

function downloadCsv(filename: string, csv: string): void {
  // Prepend a BOM so Excel opens the file as UTF-8
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(s: string | undefined): string {
  if (!s) return 'sprint';
  return s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'sprint';
}

function TaskLink({ flag }: { flag: QAFlag }) {
  if (flag.taskUrl) {
    return (
      <a
        href={flag.taskUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-300 underline hover:text-cyan-200"
      >
        {flag.taskTitle}
      </a>
    );
  }
  return <span className="text-slate-100">{flag.taskTitle}</span>;
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="text-slate-500">—</span>;
  const isComplete = status.trim().toLowerCase() === 'complete';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        isComplete ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'
      }`}
    >
      {status}
    </span>
  );
}

interface QALogPanelProps {
  flags: QAFlag[];
  sprintId?: string;
}

export function QALogPanel({ flags, sprintId }: QALogPanelProps) {
  if (flags.length === 0) {
    return (
      <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <p className="text-emerald-400 font-medium">✓ No data issues found</p>
      </div>
    );
  }

  const flagsByType = flags.reduce(
    (acc, flag) => {
      if (!acc[flag.type]) acc[flag.type] = [];
      acc[flag.type].push(flag);
      return acc;
    },
    {} as Record<QAFlagType, QAFlag[]>
  );

  const sectionsPresent = SECTIONS.filter((s) => flagsByType[s.type]?.length);

  const severityOf = (type: QAFlagType) => SECTIONS.find((s) => s.type === type)?.severity;
  const errorCount = flags.filter((f) => severityOf(f.type) === 'error').length;
  const warningCount = flags.filter((f) => severityOf(f.type) === 'warning').length;
  const infoCount = flags.filter((f) => severityOf(f.type) === 'info').length;

  const slug = slugify(sprintId);

  // Combined CSV across every section
  function downloadAll() {
    const headers = ['Issue', 'Task Title', 'Task Link', 'Assignee', 'Status', 'Est Hours', 'Actual Hours', 'Story Points', 'Detail'];
    const rows: string[][] = [];
    for (const section of sectionsPresent) {
      for (const f of flagsByType[section.type]) {
        rows.push([
          section.title,
          f.taskTitle ?? '',
          f.taskUrl ?? '',
          f.assignee ?? '',
          f.status ?? '',
          f.hoursEstimate ?? '',
          f.hoursActual ?? '',
          f.storyPoints ?? '',
          section.extraValue ? section.extraValue(f) : '',
        ]);
      }
    }
    downloadCsv(`data-quality-${slug}.csv`, buildCsv(headers, rows));
  }

  // Per-section CSV
  function downloadSection(section: SectionDef) {
    const headers = ['Task Title', 'Task Link', 'Assignee', 'Status', 'Est Hours', 'Actual Hours', 'Story Points'];
    if (section.extraHeader) headers.push(section.extraHeader);
    const rows = flagsByType[section.type].map((f) => {
      const base = [
        f.taskTitle ?? '',
        f.taskUrl ?? '',
        f.assignee ?? '',
        f.status ?? '',
        f.hoursEstimate ?? '',
        f.hoursActual ?? '',
        f.storyPoints ?? '',
      ];
      if (section.extraHeader) base.push(section.extraValue ? section.extraValue(f) : '');
      return base;
    });
    downloadCsv(`data-quality-${section.type}-${slug}.csv`, buildCsv(headers, rows));
  }

  return (
    <div className="mt-6 glass-card border border-white/20 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-3">
          {errorCount > 0 && <Badge label={`${errorCount} Errors`} variant="error" />}
          {warningCount > 0 && <Badge label={`${warningCount} Warnings`} variant="warning" />}
          {infoCount > 0 && <Badge label={`${infoCount} Info`} variant="info" />}
        </div>
        <button
          onClick={downloadAll}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 hover:border-white/40 transition-colors"
        >
          ⬇ Download all (CSV)
        </button>
      </div>

      <div className="space-y-4">
        {sectionsPresent.map((section) => {
          const rows = flagsByType[section.type];
          return (
            <details key={section.type} open className="border border-white/10 rounded-lg overflow-hidden">
              <summary className="cursor-pointer select-none flex items-center justify-between gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors">
                <span className={`font-semibold ${section.color}`}>
                  {section.title} ({rows.length})
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    downloadSection(section);
                  }}
                  className="shrink-0 text-xs font-medium px-2 py-1 rounded border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  ⬇ CSV
                </span>
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-left">
                      <th className="px-4 py-2 font-semibold text-cyan-300">Task</th>
                      <th className="px-4 py-2 font-semibold text-cyan-300">Assignee</th>
                      <th className="px-4 py-2 font-semibold text-cyan-300">Status</th>
                      <th className="px-4 py-2 font-semibold text-cyan-300">Est Hours</th>
                      <th className="px-4 py-2 font-semibold text-cyan-300">Actual Hours</th>
                      <th className="px-4 py-2 font-semibold text-cyan-300">Story Points</th>
                      {section.extraHeader && (
                        <th className="px-4 py-2 font-semibold text-cyan-300">{section.extraHeader}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((flag, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'hover:bg-white/5' : 'bg-white/3 hover:bg-white/8'}>
                        <td className="px-4 py-2 border-b border-white/5">
                          <TaskLink flag={flag} />
                        </td>
                        <td className="px-4 py-2 border-b border-white/5 text-slate-200">
                          {flag.assignee || '—'}
                        </td>
                        <td className="px-4 py-2 border-b border-white/5">
                          <StatusPill status={flag.status} />
                        </td>
                        <td className="px-4 py-2 border-b border-white/5 text-slate-300">
                          {flag.hoursEstimate?.trim() || '—'}
                        </td>
                        <td className="px-4 py-2 border-b border-white/5 text-slate-300">
                          {flag.hoursActual?.trim() || '—'}
                        </td>
                        <td className="px-4 py-2 border-b border-white/5 text-slate-300">
                          {flag.storyPoints?.trim() || '—'}
                        </td>
                        {section.extraHeader && (
                          <td className="px-4 py-2 border-b border-white/5 text-slate-300">
                            {(section.extraValue && section.extraValue(flag)) || '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
