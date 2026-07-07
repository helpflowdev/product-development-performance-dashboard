'use client';

import { useState } from 'react';
import { SprintSelector } from '@/components/burndown/SprintSelector';
import { AllottedPointsSelect } from '@/components/burndown/AllottedPointsSelect';
import { SprintMeta } from '@/types/sprint';

export interface ScorecardGenerateInput {
  sprintId: string;
  allottedStoryPoints: number;
  uptimeNote: string;
  completionGoal: number;
}

interface GenerateScorecardDialogProps {
  isOpen: boolean;
  sprints: SprintMeta[];
  generating: boolean;
  error: string | null;
  onGenerate: (input: ScorecardGenerateInput) => void;
  onClose: () => void;
}

const DEFAULT_GOAL = 95;

/**
 * Floating dialog that kicks off a Weekly Scorecard. Pick a sprint, allotted
 * story points, an uptime note, and a completion goal → Generate. The computed
 * scorecard renders on the page (not another dialog), so this closes on success.
 */
export function GenerateScorecardDialog({
  isOpen,
  sprints,
  generating,
  error,
  onGenerate,
  onClose,
}: GenerateScorecardDialogProps) {
  const [selectedSprint, setSelectedSprint] = useState('');
  const [allottedPoints, setAllottedPoints] = useState<number | null>(null);
  const [uptimeNote, setUptimeNote] = useState('0% downtime for HAS and MyHF.');
  const [goal, setGoal] = useState<number>(DEFAULT_GOAL);

  if (!isOpen) return null;

  // Default to the latest sprint until the user picks one (list is newest-first).
  const effectiveSprint = selectedSprint || (sprints[0]?.id ?? '');
  const canGenerate =
    !generating &&
    effectiveSprint.length > 0 &&
    allottedPoints !== null &&
    allottedPoints > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={!generating ? onClose : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative glass-card border border-white/20 rounded-xl shadow-2xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Generate Weekly Scorecard</h2>
          {!generating && (
            <button
              onClick={onClose}
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
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <SprintSelector
            sprints={sprints}
            selectedSprint={effectiveSprint}
            onSprintChange={setSelectedSprint}
            disabled={generating || sprints.length === 0}
          />

          <AllottedPointsSelect
            selectedPoints={allottedPoints}
            onPointsChange={setAllottedPoints}
            disabled={generating}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="uptime-note" className="block text-sm font-medium text-slate-300">
              Uptime Note
            </label>
            <input
              id="uptime-note"
              type="text"
              value={uptimeNote}
              onChange={(e) => setUptimeNote(e.target.value)}
              disabled={generating}
              placeholder="e.g. 0% downtime for HAS and MyHF."
              className="glass-input px-4 py-3 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="goal" className="block text-sm font-medium text-slate-300">
              Completion Goal (%)
            </label>
            <input
              id="goal"
              type="number"
              min={0}
              max={100}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              disabled={generating}
              className="glass-input px-4 py-3 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={() =>
              canGenerate &&
              onGenerate({
                sprintId: effectiveSprint,
                allottedStoryPoints: allottedPoints!,
                uptimeNote: uptimeNote.trim(),
                completionGoal: Number.isFinite(goal) ? goal : DEFAULT_GOAL,
              })
            }
            disabled={!canGenerate}
            className="neon-btn w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Generating...
              </span>
            ) : (
              'Generate Scorecard'
            )}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Pick a sprint and allotted points. You can review and edit the uptime
            note and analytical summary on the page before sending to Asana.
          </p>
        </div>
      </div>
    </div>
  );
}
