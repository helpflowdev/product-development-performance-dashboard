'use client';

import { useState } from 'react';
import { SprintSelector } from '@/components/burndown/SprintSelector';
import { SprintMeta } from '@/types/sprint';

interface GenerateSprintSummaryDialogProps {
  isOpen: boolean;
  sprints: SprintMeta[];
  generating: boolean;
  /** Error from the generate request, shown inside the dialog. */
  error: string | null;
  onGenerate: (sprintId: string) => void;
  onClose: () => void;
}

/**
 * Floating dialog that kicks off a Sprint Summary. Pick a sprint → Generate.
 * The computed summary is rendered on the page (not in another dialog), so this
 * closes once generation succeeds.
 */
export function GenerateSprintSummaryDialog({
  isOpen,
  sprints,
  generating,
  error,
  onGenerate,
  onClose,
}: GenerateSprintSummaryDialogProps) {
  const [selectedSprint, setSelectedSprint] = useState('');

  if (!isOpen) return null;

  // Derive the effective selection so we don't need a setState-in-effect to seed
  // the default: until the user picks one, fall back to the latest sprint
  // (the list is reverse-chronological, so index 0 is newest).
  const effectiveSprint = selectedSprint || (sprints[0]?.id ?? '');
  const canGenerate = !generating && effectiveSprint.length > 0;

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
          <h2 className="text-lg font-bold text-white">Generate Sprint Summary</h2>
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

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={() => canGenerate && onGenerate(effectiveSprint)}
            disabled={!canGenerate}
            className="neon-btn w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Generating...
              </span>
            ) : (
              'Generate Sprint Summary'
            )}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Pick a sprint and generate the summary. You can review it on the page
            before sending it to Asana.
          </p>
        </div>
      </div>
    </div>
  );
}
