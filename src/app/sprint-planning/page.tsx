'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SprintSelector } from '@/components/burndown/SprintSelector';
import { SprintPlanningTable } from '@/components/sprint-planning/SprintPlanningTable';
import { SprintMeta } from '@/types/sprint';
import { SprintPlanningResponse } from '@/types/sprint-planning';

export default function SprintPlanningPage() {
  const [sprints, setSprints] = useState<SprintMeta[]>([]);
  const [selectedSprint, setSelectedSprint] = useState('');
  const [results, setResults] = useState<SprintPlanningResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sprint list on mount and default-select the latest sprint.
  useEffect(() => {
    const loadSprints = async () => {
      try {
        const res = await fetch('/api/sprints');
        if (!res.ok) throw new Error('Failed to load sprints');
        const data = await res.json();
        const list: SprintMeta[] = data.sprints || [];
        setSprints(list);
        if (list.length > 0) setSelectedSprint(list[0].id); // reverse-chronological → latest
      } catch (err) {
        console.error('Error loading sprints:', err);
        setError(`Error: ${String(err).replace('Error: ', '')}`);
      }
    };
    loadSprints();
  }, []);

  // Fetch planning hours whenever the selected sprint changes.
  useEffect(() => {
    if (!selectedSprint) {
      setResults(null);
      return;
    }

    let cancelled = false;
    const loadPlanning = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/sprint-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprintId: selectedSprint }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data: SprintPlanningResponse = await res.json();
        if (!cancelled) setResults(data);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading sprint planning:', err);
          setError(`Error: ${String(err).replace('Error: ', '')}`);
          setResults(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPlanning();
    return () => {
      cancelled = true;
    };
  }, [selectedSprint]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-white mb-8">Sprint Planning Hours</h1>

        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <p className="text-red-700">{error}</p>
          </Card>
        )}

        <Card className="mb-8">
          <div className="max-w-md">
            <SprintSelector
              sprints={sprints}
              selectedSprint={selectedSprint}
              onSprintChange={setSelectedSprint}
              disabled={sprints.length === 0}
            />
          </div>
        </Card>

        {loading && <LoadingSpinner />}

        {!loading && results && results.members.length > 0 && (
          <Card>
            <SprintPlanningTable members={results.members} sprintId={results.sprintId} />
          </Card>
        )}

        {!loading && results && results.members.length === 0 && (
          <Card>
            <p className="text-slate-300">
              No roster members have plotted tasks for this sprint.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
