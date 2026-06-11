'use client';

import { useEffect, useState } from 'react';
import { SprintPlanningMemberStat } from '@/types/sprint-planning';
import {
  PlanningRole,
  ROLE_GROUP_ORDER,
  DEFAULT_GROSS_HOURS,
  computeNetBudget,
  roleNeedsBreak,
} from '@/lib/sprint-planning-roster';

interface SprintPlanningTableProps {
  members: SprintPlanningMemberStat[];
  sprintId: string;
}

const STORAGE_KEY = 'spd:sprint-planning:budget:v1';

const GROUP_LABEL: Record<PlanningRole, string> = {
  'QA Tester': 'QA Testers',
  'Product Specialist': 'Product Specialists',
  Developer: 'Developers',
};

/** Stored shape: { [sprintId]: { [assigneeName]: grossHours } } */
type BudgetStore = Record<string, Record<string, number>>;

function readStore(): BudgetStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BudgetStore) : {};
  } catch {
    return {};
  }
}

function writeSprintBudgets(sprintId: string, budgets: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    const store = readStore();
    store[sprintId] = budgets;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / serialization errors — persistence is best-effort */
  }
}

/** Format hours: trim trailing zeros, append "h". */
function fmtH(n: number): string {
  return `${Math.round(n * 100) / 100} h`;
}

/** Format story points: trim trailing zeros, append "pts". */
function fmtPts(n: number): string {
  return `${Math.round(n * 100) / 100} pts`;
}

export function SprintPlanningTable({ members, sprintId }: SprintPlanningTableProps) {
  // Editable gross hours per member name, kept as strings for clean editing.
  const [grossByName, setGrossByName] = useState<Record<string, string>>({});

  // Load saved gross values whenever the sprint or member set changes.
  const memberKey = members.map((m) => m.assigneeName).join('|');
  useEffect(() => {
    const saved = readStore()[sprintId] ?? {};
    const next: Record<string, string> = {};
    for (const m of members) {
      const v = saved[m.assigneeName];
      next[m.assigneeName] = String(typeof v === 'number' ? v : DEFAULT_GROSS_HOURS);
    }
    setGrossByName(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintId, memberKey]);

  const getGrossNum = (name: string): number => {
    const raw = grossByName[name];
    const n = parseFloat(raw ?? '');
    return Number.isFinite(n) ? n : 0;
  };

  const handleGrossChange = (name: string, value: string) => {
    setGrossByName((prev) => {
      const next = { ...prev, [name]: value };
      const budgets: Record<string, number> = {};
      for (const m of members) {
        const n = parseFloat(next[m.assigneeName] ?? '');
        budgets[m.assigneeName] = Number.isFinite(n) ? n : 0;
      }
      writeSprintBudgets(sprintId, budgets);
      return next;
    });
  };

  const groups = ROLE_GROUP_ORDER.map((role) => ({
    role,
    members: members.filter((m) => m.role === role),
  })).filter((g) => g.members.length > 0);

  // Overall totals (Posted uses the net budget per member).
  const totals = members.reduce(
    (acc, m) => {
      acc.gross += getGrossNum(m.assigneeName);
      acc.posted += computeNetBudget(getGrossNum(m.assigneeName), m.role);
      acc.completed += m.completedHours;
      acc.assigned += m.assignedHours;
      acc.remaining += m.remainingHours;
      acc.assignedSP += m.assignedStoryPoints;
      acc.actualSP += m.actualStoryPoints;
      return acc;
    },
    { gross: 0, posted: 0, completed: 0, assigned: 0, remaining: 0, assignedSP: 0, actualSP: 0 },
  );

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 text-xs text-slate-300 leading-relaxed">
        <p>
          <span className="text-slate-200 font-semibold">Budgeted Hrs</span> = gross hours a person
          can work this sprint (editable; default {DEFAULT_GROSS_HOURS} h = 10 work days × 8 h).
          Lower it for PTO/UTO.
        </p>
        <p>
          <span className="text-slate-200 font-semibold">Posted Hrs</span> = net after breaks. QA
          Testers &amp; Product Specialists lose 30 min per 8 h worked (80 → 75). Developers are
          fixed (no deduction). Edits are saved in this browser per sprint.
        </p>
        <p>
          <span className="text-slate-200 font-semibold">Assigned SP</span> = committed story
          points (all tasks); <span className="text-slate-200 font-semibold">Actual SP</span> =
          delivered story points (completed tasks).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">
                Budgeted Hrs (gross)
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">
                Posted Hrs (net)
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">
                Completed (Actual)
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">
                Assigned (Est)
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">Remaining</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">
                Assigned SP
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-300">Actual SP</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((group) => {
              const rows: React.ReactNode[] = [];

              // Group header
              rows.push(
                <tr key={`hdr-${group.role}`} className="bg-white/[0.07] border-b border-white/10">
                  <td
                    colSpan={8}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-purple-300"
                  >
                    {GROUP_LABEL[group.role]}
                  </td>
                </tr>,
              );

              // Member rows
              for (const m of group.members) {
                const gross = getGrossNum(m.assigneeName);
                const posted = computeNetBudget(gross, m.role);
                const overBooked = m.assignedHours > posted;
                rows.push(
                  <tr key={m.assigneeName} className="border-b border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-white font-medium">{m.assigneeName}</td>
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={grossByName[m.assigneeName] ?? ''}
                        onChange={(e) => handleGrossChange(m.assigneeName, e.target.value)}
                        className="glass-input w-24 px-2 py-1.5 rounded-md text-sm text-slate-100 border border-white/20 focus:border-cyan-400 outline-none"
                        style={{ background: '#1a1440' }}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {fmtH(posted)}
                      {!roleNeedsBreak(m.role) && (
                        <span className="ml-2 text-[10px] text-slate-400">fixed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">{fmtH(m.completedHours)}</td>
                    <td
                      className={`px-4 py-3 text-sm ${
                        overBooked ? 'text-amber-300 font-semibold' : 'text-slate-200'
                      }`}
                      title={overBooked ? 'Assigned hours exceed posted budget' : undefined}
                    >
                      {fmtH(m.assignedHours)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">{fmtH(m.remainingHours)}</td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {fmtPts(m.assignedStoryPoints)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {fmtPts(m.actualStoryPoints)}
                    </td>
                  </tr>,
                );
              }

              // Group subtotal
              const sub = group.members.reduce(
                (acc, m) => {
                  acc.gross += getGrossNum(m.assigneeName);
                  acc.posted += computeNetBudget(getGrossNum(m.assigneeName), m.role);
                  acc.completed += m.completedHours;
                  acc.assigned += m.assignedHours;
                  acc.remaining += m.remainingHours;
                  acc.assignedSP += m.assignedStoryPoints;
                  acc.actualSP += m.actualStoryPoints;
                  return acc;
                },
                { gross: 0, posted: 0, completed: 0, assigned: 0, remaining: 0, assignedSP: 0, actualSP: 0 },
              );
              rows.push(
                <tr key={`sub-${group.role}`} className="border-b border-white/10 bg-white/[0.03]">
                  <td className="px-4 py-2 text-xs italic text-slate-400">
                    {GROUP_LABEL[group.role]} subtotal
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmtH(sub.gross)}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmtH(sub.posted)}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmtH(sub.completed)}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmtH(sub.assigned)}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmtH(sub.remaining)}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmtPts(sub.assignedSP)}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{fmtPts(sub.actualSP)}</td>
                </tr>,
              );

              return rows;
            })}

            {/* Grand total */}
            <tr className="border-t-2 border-white/20 bg-white/[0.06]">
              <td className="px-4 py-3 text-sm font-bold text-white">Total</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-100">{fmtH(totals.gross)}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-100">{fmtH(totals.posted)}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-100">{fmtH(totals.completed)}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-100">{fmtH(totals.assigned)}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-100">{fmtH(totals.remaining)}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-100">{fmtPts(totals.assignedSP)}</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-100">{fmtPts(totals.actualSP)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
