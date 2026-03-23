'use client';

import { useEffect, useState } from 'react';
import { SprintMeta } from '@/types/sprint';
import { BurndownResponse } from '@/types/burndown';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SprintSelector } from '@/components/burndown/SprintSelector';
import { AllottedPointsSelect } from '@/components/burndown/AllottedPointsSelect';
import { GenerateButton } from '@/components/burndown/GenerateButton';
import { BurndownChart } from '@/components/burndown/BurndownChart';
import { BurndownTable } from '@/components/burndown/BurndownTable';
import { QALogPanel } from '@/components/burndown/QALogPanel';

export default function BurndownPage() {
  const [sprints, setSprints] = useState<SprintMeta[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<string>('');
  const [allottedPoints, setAllottedPoints] = useState<number | null>(null);
  const [burndownData, setBurndownData] = useState<BurndownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sprints on mount
  useEffect(() => {
    async function fetchSprints() {
      try {
        const res = await fetch('/api/sprints');
        if (!res.ok) throw new Error('Failed to fetch sprints');
        const data = await res.json();
        setSprints(data.sprints);
        // Pre-select the first (most recent) sprint
        if (data.sprints.length > 0) {
          setSelectedSprint(data.sprints[0].id);
        }
      } catch (err) {
        setError(`Error fetching sprints: ${String(err)}`);
      }
    }
    fetchSprints();
  }, []);

  const handleGenerate = async () => {
    if (!selectedSprint || !allottedPoints) {
      setError('Please select a sprint and allotted points');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/burndown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintId: selectedSprint,
          allottedPoints,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate burndown');
      }

      const data = await res.json();
      setBurndownData(data);
    } catch (err) {
      setError(`Error generating burndown: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto bg-slate-900">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Sprint Burndown Chart</h1>

        {/* Input Card */}
        <Card className="mb-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <SprintSelector
              sprints={sprints}
              selectedSprint={selectedSprint}
              onSprintChange={setSelectedSprint}
              disabled={loading}
            />
            <AllottedPointsSelect
              selectedPoints={allottedPoints}
              onPointsChange={setAllottedPoints}
              disabled={loading}
            />
            <div className="flex items-end">
              <GenerateButton
                onClick={handleGenerate}
                disabled={!selectedSprint || !allottedPoints}
                loading={loading}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-100">
              {error}
            </div>
          )}
        </Card>

        {/* Chart and Results */}
        {loading && <LoadingSpinner />}

        {burndownData && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <Card className="bg-white">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-gray-600 text-sm">Total Allotted Points</p>
                  <p className="text-2xl font-bold text-gray-900">{burndownData.allottedPoints}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Total Consumed Points</p>
                  <p className="text-2xl font-bold text-blue-600">{burndownData.totalConsumedPoints}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Burndown Rate</p>
                  <p className="text-2xl font-bold text-green-600">{burndownData.burndownRate}</p>
                </div>
              </div>
            </Card>

            {/* Chart */}
            <Card className="bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Burndown Trend</h2>
              <BurndownChart data={burndownData.days} allottedPoints={burndownData.allottedPoints} />
            </Card>

            {/* Data Table */}
            <Card className="bg-white">
              <BurndownTable data={burndownData.days} />
            </Card>

            {/* QA Log */}
            <Card className="bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Quality</h2>
              <QALogPanel flags={burndownData.qaFlags} />
            </Card>

            {/* Footer */}
            <div className="text-center text-sm text-gray-400">
              Generated at {new Date(burndownData.computedAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
