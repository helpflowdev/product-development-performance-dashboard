'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { SyncResult } from '@/types/sync';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

type InputMode = 'existing' | 'manual';
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

function getTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SyncModal({ isOpen, onClose }: SyncModalProps) {
  const [inputMode, setInputMode] = useState<InputMode>('existing');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [manualSprintName, setManualSprintName] = useState('');
  const [asanaSprints, setAsanaSprints] = useState<
    Array<{ gid: string; name: string }>
  >([]);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<SyncResult | null>(null);
  const logPanelRef = useRef<HTMLDivElement>(null);

  const sprintName =
    inputMode === 'existing' ? selectedSprint : manualSprintName.trim();
  const canSync = syncStatus !== 'syncing' && sprintName.length > 0;

  // Fetch Asana sprints when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadingSprints(true);
    fetch('/api/asana-sprints')
      .then((res) => res.json())
      .then((data) => {
        if (data.sprints) setAsanaSprints(data.sprints);
      })
      .catch((err) => console.error('Failed to fetch Asana sprints:', err))
      .finally(() => setLoadingSprints(false));
  }, [isOpen]);

  // Auto-scroll log panel
  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [logEntries]);

  const addLog = useCallback(
    (message: string, type: LogEntry['type'] = 'info') => {
      setLogEntries((prev) => [
        ...prev,
        { timestamp: getTimestamp(), message, type },
      ]);
    },
    [],
  );

  async function handleSync() {
    if (!canSync) return;

    setSyncStatus('syncing');
    setLogEntries([]);
    setResult(null);
    addLog(`Starting sync for: ${sprintName}`);

    let receivedTerminalEvent = false;

    try {
      const response = await fetch('/api/sync-sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprintName }),
      });

      if (!response.ok && !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          const lines = eventStr.split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (!eventType || !eventData) continue;

          try {
            const parsed = JSON.parse(eventData);

            if (eventType === 'progress') {
              addLog(parsed.message);
            } else if (eventType === 'done') {
              receivedTerminalEvent = true;
              addLog('Sync complete!', 'success');
              setResult(parsed as SyncResult);
              setSyncStatus('success');
            } else if (eventType === 'error') {
              receivedTerminalEvent = true;
              addLog(parsed.error || 'Unknown error', 'error');
              setResult(parsed as SyncResult);
              setSyncStatus('error');
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      // If stream ended without a done/error event
      if (!receivedTerminalEvent) {
        setSyncStatus('error');
        addLog('Connection closed unexpectedly', 'error');
      }
    } catch (error) {
      addLog(String(error), 'error');
      setSyncStatus('error');
    }
  }

  function handleSyncAnother() {
    setSyncStatus('idle');
    setLogEntries([]);
    setResult(null);
    setSelectedSprint('');
    setManualSprintName('');
  }

  function handleClose() {
    if (syncStatus === 'syncing') return;
    setSyncStatus('idle');
    setLogEntries([]);
    setResult(null);
    setSelectedSprint('');
    setManualSprintName('');
    onClose();
  }

  if (!isOpen) return null;

  const dropdownOptions = asanaSprints.map((s) => ({
    value: s.name,
    label: s.name,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={syncStatus !== 'syncing' ? handleClose : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative glass-card border border-white/20 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Update Sprint Data</h2>
          {syncStatus !== 'syncing' && (
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
          {/* Input mode toggle */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="inputMode"
                checked={inputMode === 'existing'}
                onChange={() => setInputMode('existing')}
                disabled={syncStatus === 'syncing'}
                className="accent-cyan-400"
              />
              <span className="text-sm text-slate-300">
                Select from Asana
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="inputMode"
                checked={inputMode === 'manual'}
                onChange={() => setInputMode('manual')}
                disabled={syncStatus === 'syncing'}
                className="accent-cyan-400"
              />
              <span className="text-sm text-slate-300">
                Enter sprint name manually
              </span>
            </label>
          </div>

          {/* Sprint input */}
          {inputMode === 'existing' ? (
            <SelectDropdown
              label="Sprint"
              options={dropdownOptions}
              value={selectedSprint}
              onChange={setSelectedSprint}
              disabled={syncStatus === 'syncing' || loadingSprints}
              placeholder={
                loadingSprints ? 'Loading sprints...' : '-- Select a sprint --'
              }
            />
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Sprint Name
              </label>
              <input
                type="text"
                value={manualSprintName}
                onChange={(e) => setManualSprintName(e.target.value)}
                disabled={syncStatus === 'syncing'}
                placeholder='Sprint #2025.Q1.S3 (0205-0218)'
                className="glass-input w-full px-3 py-3 rounded-lg text-slate-100 font-medium border border-white/20 hover:border-white/40 focus:border-cyan-400/50 focus:outline-none transition-all disabled:opacity-50"
              />
            </div>
          )}

          {/* Sync button */}
          {syncStatus !== 'success' && syncStatus !== 'error' && (
            <button
              onClick={handleSync}
              disabled={!canSync}
              className="neon-btn w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {syncStatus === 'syncing' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                  Syncing...
                </span>
              ) : (
                'Sync Now'
              )}
            </button>
          )}

          {/* Progress log */}
          {logEntries.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Progress Log
              </label>
              <div
                ref={logPanelRef}
                className="glass-input rounded-lg p-3 h-52 overflow-y-auto font-mono text-xs leading-relaxed border border-white/10"
              >
                {logEntries.map((entry, i) => (
                  <div
                    key={i}
                    className={`${
                      entry.type === 'success'
                        ? 'text-emerald-400'
                        : entry.type === 'error'
                          ? 'text-red-400'
                          : 'text-cyan-300'
                    }`}
                  >
                    <span className="text-slate-500">[{entry.timestamp}]</span>{' '}
                    {entry.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion summary card */}
          {result && (syncStatus === 'success' || syncStatus === 'error') && (
            <div
              className={`rounded-lg border p-4 ${
                syncStatus === 'success'
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-red-500/50 bg-red-500/10'
              }`}
            >
              <h3
                className={`font-semibold mb-2 ${
                  syncStatus === 'success'
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {syncStatus === 'success' ? 'Sync Successful' : 'Sync Failed'}
              </h3>
              <div className="text-sm text-slate-300 space-y-1">
                <p>
                  <span className="text-slate-400">Sprint:</span>{' '}
                  {result.sprintName}
                </p>
                {syncStatus === 'success' && (
                  <>
                    <p>
                      <span className="text-slate-400">Updated:</span>{' '}
                      {result.tasksUpdated} tasks
                    </p>
                    <p>
                      <span className="text-slate-400">Inserted:</span>{' '}
                      {result.tasksInserted} tasks
                    </p>
                    <p>
                      <span className="text-slate-400">Deleted:</span>{' '}
                      {result.tasksDeleted} tasks
                    </p>
                    <p>
                      <span className="text-slate-400">Total:</span>{' '}
                      {result.totalTasks} tasks
                    </p>
                  </>
                )}
                {result.error && (
                  <p className="text-red-400">{result.error}</p>
                )}
                <p>
                  <span className="text-slate-400">Duration:</span>{' '}
                  {(result.durationMs / 1000).toFixed(1)}s
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2 rounded-lg border border-white/20 text-slate-300 hover:bg-white/10 transition-all text-sm font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleSyncAnother}
                  className="flex-1 py-2 rounded-lg neon-btn text-white text-sm font-medium"
                >
                  Sync Another
                </button>
              </div>
            </div>
          )}

          {/* Idle hint */}
          {syncStatus === 'idle' && logEntries.length === 0 && (
            <p className="text-xs text-slate-500 text-center">
              Select a sprint and click Sync to update the Google Sheet with the
              latest Asana task data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
