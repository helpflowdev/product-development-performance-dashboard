'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { GenerateSprintSummaryDialog } from '@/components/sprint-summary/GenerateSprintSummaryDialog';
import { SprintSummaryView } from '@/components/sprint-summary/SprintSummaryView';
import { SprintMeta } from '@/types/sprint';
import { SprintSummaryResponse, SendToAsanaResult } from '@/types/sprint-summary';

type SendStatus = 'idle' | 'confirm' | 'sending' | 'success' | 'error';

export default function SprintSummaryPage() {
  const [sprints, setSprints] = useState<SprintMeta[]>([]);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SprintSummaryResponse | null>(null);

  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [sendResult, setSendResult] = useState<SendToAsanaResult | null>(null);

  // Load sprint list on mount.
  useEffect(() => {
    fetch('/api/sprints')
      .then((res) => res.json())
      .then((data) => setSprints(data.sprints || []))
      .catch((err) => console.error('Failed to load sprints:', err));
  }, []);

  async function handleGenerate(sprintId: string) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/sprint-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: SprintSummaryResponse = await res.json();
      setSummary(data);
      // New summary invalidates any previous send outcome.
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
    if (!summary) return;
    setSendStatus('sending');
    setSendResult(null);
    try {
      const res = await fetch('/api/sprint-summary/send-to-asana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintId: summary.sprintId }),
      });
      const data: SendToAsanaResult = await res.json();
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
        sprintId: summary.sprintId,
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
          <h1 className="text-xl font-bold text-white">Sprint Summary</h1>

          {summary && (
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
        {summary && sendStatus === 'confirm' && (
          <Card className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-slate-300 flex-1">
              Create a <span className="text-slate-100 font-medium">Sprint Summary</span>{' '}
              task in Asana and post the summary + task lists as comments?
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

        {summary && sendStatus === 'success' && sendResult && (
          <Card className="mb-6 border border-emerald-500/50 bg-emerald-500/10">
            <h3 className="font-semibold text-emerald-400 mb-1">Sent to Asana</h3>
            <p className="text-sm text-slate-300">
              Created task{' '}
              <span className="text-slate-100">{`Sprint Summary: ${summary.sprintId}`}</span>
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
                Open task in Asana →
              </a>
            )}
          </Card>
        )}

        {summary && sendStatus === 'error' && sendResult && (
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

        {/* Summary content */}
        {summary ? (
          <SprintSummaryView summary={summary} />
        ) : (
          !dialogOpen && (
            <Card className="text-center">
              <p className="text-slate-300 mb-4">No summary generated yet.</p>
              <button
                onClick={() => setDialogOpen(true)}
                className="neon-btn px-6 py-3 rounded-lg font-semibold text-white"
              >
                Generate Sprint Summary
              </button>
            </Card>
          )
        )}
      </div>

      <GenerateSprintSummaryDialog
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
