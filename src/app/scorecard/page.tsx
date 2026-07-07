'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import {
  GenerateScorecardDialog,
  ScorecardGenerateInput,
} from '@/components/scorecard/GenerateScorecardDialog';
import { ScorecardView } from '@/components/scorecard/ScorecardView';
import { SprintMeta } from '@/types/sprint';
import { ScorecardResponse, ScorecardSendResult } from '@/types/scorecard';

type SendStatus = 'idle' | 'confirm' | 'sending' | 'success' | 'error';

export default function ScorecardPage() {
  const [sprints, setSprints] = useState<SprintMeta[]>([]);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);

  // Editable fields prefilled from the computed scorecard, posted to Asana on send.
  const [narrativeText, setNarrativeText] = useState('');
  const [uptimeText, setUptimeText] = useState('');

  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendResult, setSendResult] = useState<ScorecardSendResult | null>(null);

  // Load sprint list on mount.
  useEffect(() => {
    fetch('/api/sprints')
      .then((res) => res.json())
      .then((data) => setSprints(data.sprints || []))
      .catch((err) => console.error('Failed to load sprints:', err));
  }, []);

  async function handleGenerate(input: ScorecardGenerateInput) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: ScorecardResponse = await res.json();
      setScorecard(data);
      setNarrativeText(data.narrative ?? '');
      setUptimeText(data.uptimeNote ?? '');
      // New scorecard invalidates any previous send outcome.
      setSendStatus('idle');
      setSendResult(null);
      setDialogOpen(false);
    } catch (err) {
      setGenerateError(`Error: ${String(err).replace('Error: ', '')}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!scorecard) return;
    setSendStatus('sending');
    setSendResult(null);
    try {
      const res = await fetch('/api/scorecard/send-to-asana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintId: scorecard.sprintId,
          allottedStoryPoints: scorecard.allottedStoryPoints,
          completionGoal: scorecard.completionGoal,
          uptimeNote: uptimeText.trim(),
          narrative: narrativeText.trim() || undefined,
        }),
      });
      const data: ScorecardSendResult = await res.json();
      if (!res.ok || !data.success) {
        setSendResult(data);
        setSendStatus('error');
        return;
      }
      setSendResult(data);
      setSendStatus('success');
    } catch (err) {
      setSendResult({
        success: false,
        sprintId: scorecard.sprintId,
        error: String(err).replace('Error: ', ''),
      });
      setSendStatus('error');
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header with action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-xl font-bold text-white">Weekly Scorecard</h1>

          {scorecard && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setGenerateError(null);
                  setDialogOpen(true);
                }}
                className="px-4 py-2 rounded-lg border border-white/20 text-slate-200 hover:bg-white/10 transition-all text-sm font-medium"
              >
                Generate Another
              </button>

              {sendStatus === 'success' ? (
                <span className="px-4 py-2 text-sm font-medium text-emerald-400">
                  Sent ✓
                </span>
              ) : (
                <button
                  onClick={() => setSendStatus('confirm')}
                  disabled={sendStatus === 'sending' || sendStatus === 'confirm'}
                  className="neon-btn px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                >
                  {sendStatus === 'sending' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                      Sending...
                    </span>
                  ) : (
                    'Send to Asana'
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status banners */}
        {scorecard && sendStatus === 'confirm' && (
          <Card className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-slate-300 flex-1">
              Create the{' '}
              <span className="text-slate-100 font-medium">Weekly Scorecard</span>{' '}
              subtask in Asana and post the scorecard as a pinned comment?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSendStatus('idle')}
                className="px-4 py-2 rounded-lg border border-white/20 text-slate-300 hover:bg-white/10 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="neon-btn px-5 py-2 rounded-lg text-white text-sm font-semibold"
              >
                Confirm &amp; Send
              </button>
            </div>
          </Card>
        )}

        {scorecard && sendStatus === 'success' && sendResult && (
          <Card className="mb-6 border border-emerald-500/50 bg-emerald-500/10">
            <h3 className="font-semibold text-emerald-400 mb-1">Sent to Asana</h3>
            <p className="text-sm text-slate-300">
              Created the Weekly Scorecard subtask for{' '}
              <span className="text-slate-100">{scorecard.sprintId}</span>
              {typeof sendResult.commentsPosted === 'number' && (
                <> with {sendResult.commentsPosted} comment(s).</>
              )}
            </p>
            {sendResult.taskUrl && (
              <a
                href={sendResult.taskUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-cyan-300 hover:text-cyan-200 hover:underline text-sm font-medium"
              >
                Open subtask in Asana →
              </a>
            )}
          </Card>
        )}

        {scorecard && sendStatus === 'error' && sendResult && (
          <Card className="mb-6 border border-red-500/50 bg-red-500/10">
            <p className="text-sm text-red-400">
              Failed to send: {sendResult.error || 'Unknown error'}
              {typeof sendResult.commentsPosted === 'number' &&
                sendResult.commentsPosted > 0 && (
                  <> ({sendResult.commentsPosted} comment(s) were posted before the failure)</>
                )}
            </p>
          </Card>
        )}

        {/* Scorecard content */}
        {scorecard ? (
          <div className="space-y-4">
            {/* Editable uptime note (posted to Asana) */}
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Uptime</h3>
                <span className="text-xs text-slate-500">
                  operator input · editable · included when sent to Asana
                </span>
              </div>
              <input
                type="text"
                value={uptimeText}
                onChange={(e) => setUptimeText(e.target.value)}
                placeholder="e.g. 0% downtime for HAS and MyHF."
                className="glass-input w-full px-3 py-2 rounded-lg text-sm text-slate-100 border border-white/20 hover:border-white/40 focus:border-cyan-400/50 focus:outline-none transition-all"
              />
            </Card>

            {/* Editable analytical narrative (posted to Asana) */}
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">Summary (Analytical)</h3>
                <span className="text-xs text-slate-500">
                  AI-generated · editable · included when sent to Asana
                </span>
              </div>
              <textarea
                value={narrativeText}
                onChange={(e) => setNarrativeText(e.target.value)}
                rows={4}
                placeholder={
                  scorecard.narrative === null
                    ? 'No AI summary (set GEMINI_API_KEY to auto-generate). You can type an analytical summary here.'
                    : 'Why did the numbers move this sprint?'
                }
                className="glass-input w-full px-3 py-2 rounded-lg text-sm text-slate-100 border border-white/20 hover:border-white/40 focus:border-cyan-400/50 focus:outline-none transition-all resize-y"
              />
              {scorecard.narrativeError && (
                <p className="mt-2 text-xs text-red-400">
                  AI summary failed: {scorecard.narrativeError}
                </p>
              )}
            </Card>

            <ScorecardView scorecard={scorecard} />
          </div>
        ) : (
          !dialogOpen && (
            <Card className="text-center">
              <p className="text-slate-300 mb-4">No scorecard generated yet.</p>
              <button
                onClick={() => setDialogOpen(true)}
                className="neon-btn px-6 py-3 rounded-lg font-semibold text-white"
              >
                Generate Weekly Scorecard
              </button>
            </Card>
          )
        )}
      </div>

      <GenerateScorecardDialog
        isOpen={dialogOpen}
        sprints={sprints}
        generating={generating}
        error={generateError}
        onGenerate={handleGenerate}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
