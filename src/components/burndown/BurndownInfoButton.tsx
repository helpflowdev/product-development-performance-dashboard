'use client';

import { useState } from 'react';

/**
 * Info button + modal documenting how every metric on the Burndown page is
 * calculated. Content is data-driven (rendered via expressions) so it stays
 * clear of the react/no-unescaped-entities lint rule.
 */

interface InfoItem {
  term: string;
  desc: string;
}

interface InfoSection {
  heading: string;
  intro?: string;
  items: InfoItem[];
}

const SECTIONS: InfoSection[] = [
  {
    heading: 'Summary tiles',
    items: [
      {
        term: 'Total Allotted Points',
        desc: 'The planned story-point budget for the sprint (chosen from the dropdown).',
      },
      {
        term: 'Total Points (completed + incomplete)',
        desc: 'The sum of story points across every task in the sprint, done or not — the actual running scope. Compare it against Total Allotted to see over- or under-commitment.',
      },
      {
        term: 'Added Points (mid-sprint)',
        desc: 'Total story points of tasks pulled into the sprint after it started — a measure of added scope. Recurring tasks are not counted.',
      },
      {
        term: 'Total Consumed Points',
        desc: 'Story points completed so far, counting only completions up to today.',
      },
      {
        term: 'Expected Points / Day',
        desc: 'The ideal daily burn: Total Allotted ÷ (sprint length in days − 1).',
      },
      {
        term: 'Burndown Rate (overall)',
        desc: 'Consumed ÷ Total Allotted, as a percentage. How far you are toward finishing the whole sprint — naturally low early on, since the denominator is the entire sprint.',
      },
      {
        term: 'Burndown Rate (up to date)',
        desc: 'Consumed ÷ the points that should be done by today, as a percentage. About 100% means you are on pace. It shows a dash before the sprint starts and converges with the overall rate on the final day.',
      },
    ],
  },
  {
    heading: 'The chart',
    items: [
      {
        term: 'Actual Remaining (cyan, solid)',
        desc: 'Allotted points minus what has been completed by each day. The line stops at today.',
      },
      {
        term: 'Ideal Burn (orange, dashed)',
        desc: 'The straight-line pace from the full allotment down to zero across the sprint.',
      },
    ],
  },
  {
    heading: 'Tasks added mid-sprint',
    intro:
      'This drives both the "Added Points (mid-sprint)" tile and the "Tasks added mid-sprint" list in Data Quality.',
    items: [
      {
        term: 'The rule',
        desc: 'A task counts as added mid-sprint when its Date Added to Sprint is after the sprint start date.',
      },
      {
        term: 'Date Added to Sprint',
        desc: 'When the task actually joined this sprint, read from Asana’s activity log — not its creation date. This is what catches backlog tasks that were created earlier but pulled into the sprint later.',
      },
      {
        term: 'Recurring tasks (DT) / (WT) / (ST)',
        desc: 'Excluded. A fresh copy spawns mid-sprint each cycle, but that is planned work, not new scope.',
      },
      {
        term: 'Removed and re-added to the same sprint',
        desc: 'The most recent add date is used.',
      },
      {
        term: 'A task in multiple sprints',
        desc: 'Each sprint is evaluated on its own — every sprint records when the task entered it. A task can be planned in one sprint and added mid-sprint in another.',
      },
    ],
  },
  {
    heading: 'Data Quality flags',
    items: [
      {
        term: 'Complete but missing burndown date',
        desc: 'A completed task with no completion date — it cannot be placed on the burndown.',
      },
      {
        term: 'Complete / Incomplete missing story points',
        desc: 'A task with no story points. Completed ones are still counted as 0.',
      },
      {
        term: 'Date outside sprint window',
        desc: 'A completion date falling before the sprint start or after the end. Still counted.',
      },
      {
        term: 'Tasks added mid-sprint',
        desc: 'Tasks whose Date Added to Sprint is after the sprint start (recurring excluded).',
      },
      {
        term: 'Tasks added to multiple sprints',
        desc: 'The same task appears in more than one sprint (carried over or pulled into another sprint).',
      },
    ],
  },
  {
    heading: 'Keeping the data fresh',
    items: [
      {
        term: 'Update Sprint Data → Sync Now',
        desc: 'Refreshes the sprint from Asana into the Google Sheet, which is what every metric here reads from.',
      },
      {
        term: 'First sync of a large sprint',
        desc: 'Date Added to Sprint is filled during Sync from Asana’s activity log. A big sprint may not finish in one run — just run Sync again and it resumes where it left off.',
      },
    ],
  },
];

export function BurndownInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How these metrics are calculated"
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 hover:border-white/40 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        How metrics work
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div
            className="relative glass-card border border-white/20 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10 sticky top-0 bg-[rgba(15,12,41,0.92)] backdrop-blur-sm">
              <h2 className="text-lg font-bold text-white">How these metrics are calculated</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {SECTIONS.map((section) => (
                <section key={section.heading}>
                  <h3 className="text-cyan-300 font-semibold mb-2">{section.heading}</h3>
                  {section.intro && (
                    <p className="text-slate-400 text-sm mb-3">{section.intro}</p>
                  )}
                  <dl className="space-y-2.5">
                    {section.items.map((item) => (
                      <div key={item.term}>
                        <dt className="text-slate-100 text-sm font-medium">{item.term}</dt>
                        <dd className="text-slate-300 text-sm leading-relaxed">{item.desc}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
