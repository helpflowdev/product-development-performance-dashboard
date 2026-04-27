'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { GenerateButton } from '@/components/burndown/GenerateButton';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MultiSelectDropdown } from '@/components/completion-rate/MultiSelectDropdown';
import { SummaryMetrics } from '@/components/completion-rate/SummaryMetrics';
import { YTDSprintTable } from '@/components/completion-rate/YTDSprintTable';
import { SprintComparisonChart } from '@/components/completion-rate/SprintComparisonChart';
import { SprintStats } from '@/components/completion-rate/SprintStats';
import { SprintMeta } from '@/types/sprint';
import { CompletionRateResponse, CompareSprintsResponse } from '@/types/completion-rate';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 4 + i);
const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function CompletionRatePage() {
  // Available options (for dropdowns)
  const [sprints, setSprints] = useState<SprintMeta[]>([]);
  const [allAssignees, setAllAssignees] = useState<string[]>([]);

  // Section 1: Multi-select filter state
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Section 1: Results
  const [completionData, setCompletionData] = useState<CompletionRateResponse | null>(null);

  // Section 2: Comparison (independent)
  const [compareSprintA, setCompareSprintA] = useState<string>('');
  const [compareSprintB, setCompareSprintB] = useState<string>('');
  const [compareData, setCompareData] = useState<CompareSprintsResponse | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyFilter =
    selectedSprints.length > 0 ||
    selectedAssignees.length > 0 ||
    selectedYears.length > 0 ||
    selectedMonths.length > 0;

  const handleClearFilters = () => {
    setSelectedSprints([]);
    setSelectedAssignees([]);
    setSelectedYears([]);
    setSelectedMonths([]);
    setCompletionData(null);
    setError(null);
  };

  // Load sprints and assignees on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        // Load sprints
        const sprintsRes = await fetch('/api/sprints');
        if (!sprintsRes.ok) throw new Error('Failed to load sprints');
        const sprintsData = await sprintsRes.json();
        setSprints(sprintsData.sprints || []);

        // Load assignees by calling completion-rate API with empty filters
        const completionRes = await fetch('/api/completion-rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (completionRes.ok) {
          const completionData = await completionRes.json();
          setAllAssignees(completionData.allAssignees || []);
        }
      } catch (err) {
        console.error('Error loading options:', err);
        setError('Failed to load filter options');
      }
    };

    loadOptions();
  }, []);

  // Handle generate main metrics
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/completion-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintIds: selectedSprints.length > 0 ? selectedSprints : undefined,
          assigneeNames: selectedAssignees.length > 0 ? selectedAssignees : undefined,
          years: selectedYears.length > 0 ? selectedYears : undefined,
          months: selectedMonths.length > 0 ? selectedMonths : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setCompletionData(data);
    } catch (err) {
      console.error('Error generating completion rate:', err);
      setError(`Error: ${String(err).replace('Error: ', '')}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle sprint comparison
  const handleCompare = async () => {
    if (!compareSprintA || !compareSprintB) {
      setError('Please select two sprints to compare');
      return;
    }

    setCompareLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/completion-rate/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintIds: [compareSprintA, compareSprintB],
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setCompareData(data);
    } catch (err) {
      console.error('Error comparing sprints:', err);
      setError(`Error: ${String(err).replace('Error: ', '')}`);
    } finally {
      setCompareLoading(false);
    }
  };

  // Convert sprint objects to options for MultiSelectDropdown
  const sprintOptions = sprints.map((s) => ({ value: s.id, label: s.id }));
  const assigneeOptions = allAssignees.map((a) => ({ value: a, label: a }));
  const yearOptions = YEARS.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-white mb-8">Sprint Completion Rate</h1>

        {/* Error display (global) */}
        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <p className="text-red-700">{error}</p>
          </Card>
        )}

        {/* ========== SECTION 1: Filter & Analyze ========== */}
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-white">Filter & Analyze</h2>
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!hasAnyFilter}
              className="text-xs text-cyan-300 hover:text-cyan-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {/* Filter grid: 2x2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <MultiSelectDropdown
              label="Sprint"
              options={sprintOptions}
              selected={selectedSprints}
              onChange={setSelectedSprints}
              disabled={loading}
              placeholder="All Sprints"
            />

            <MultiSelectDropdown
              label="Assignee"
              options={assigneeOptions}
              selected={selectedAssignees}
              onChange={setSelectedAssignees}
              disabled={loading}
              placeholder="All Assignees"
            />

            <MultiSelectDropdown
              label="Year"
              options={yearOptions}
              selected={selectedYears}
              onChange={setSelectedYears}
              disabled={loading}
              placeholder="All Years"
            />

            <MultiSelectDropdown
              label="Month"
              options={MONTHS}
              selected={selectedMonths}
              onChange={setSelectedMonths}
              disabled={loading}
              placeholder="All Months"
            />
          </div>

          {/* Generate button */}
          <div className="flex justify-end">
            <GenerateButton onClick={handleGenerate} loading={loading} />
          </div>
        </Card>

        {/* Loading spinner */}
        {loading && <LoadingSpinner />}

        {/* Results */}
        {completionData && (
          <>
            {/* Summary metrics */}
            <SummaryMetrics summary={completionData.summary} />

            {/* Sprint summary table */}
            <YTDSprintTable sprints={completionData.sprintStats} />
          </>
        )}

        {/* ========== SECTION 2: Compare Sprints (Always Visible) ========== */}
        <Card className="mb-6">
          <h2 className="text-base font-bold text-white mb-6">Compare Sprints</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-6">
            <SelectDropdown
              label="Sprint A"
              options={sprintOptions}
              value={compareSprintA}
              onChange={setCompareSprintA}
              disabled={compareLoading}
              placeholder="-- Choose a sprint --"
            />

            <SelectDropdown
              label="Sprint B"
              options={sprintOptions}
              value={compareSprintB}
              onChange={setCompareSprintB}
              disabled={compareLoading}
              placeholder="-- Choose a sprint --"
            />

            <button
              onClick={handleCompare}
              disabled={compareLoading || !compareSprintA || !compareSprintB}
              className="neon-btn px-6 py-2 text-white rounded-md font-bold h-10 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed border border-white/20 hover:border-white/40"
            >
              {compareLoading ? 'Comparing...' : 'Compare'}
            </button>
          </div>

          {/* Comparison chart */}
          <SprintComparisonChart data={compareData} loading={compareLoading} />

          {/* Sprint stats for comparison */}
          {compareData && compareData.sprints.length === 2 && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white mb-6">Sprint Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SprintStats sprint={compareData.sprints[0]} />
                <SprintStats sprint={compareData.sprints[1]} />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
