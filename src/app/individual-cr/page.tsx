'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { MultiSelectDropdown } from '@/components/completion-rate/MultiSelectDropdown';
import { GenerateButton } from '@/components/burndown/GenerateButton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IndividualCRTable } from '@/components/individual-cr/IndividualCRTable';
import { SummaryMetrics } from '@/components/completion-rate/SummaryMetrics';
import { SprintMeta } from '@/types/sprint';
import { IndividualCRResponse } from '@/types/individual-cr';

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

export default function IndividualCRPage() {
  // Available options
  const [sprints, setSprints] = useState<SprintMeta[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAssignees, setAvailableAssignees] = useState<string[]>([]);

  // Selected filters
  const [selectedSprints, setSelectedSprints] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Results and UI state
  const [results, setResults] = useState<IndividualCRResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyFilter =
    selectedSprints.length > 0 ||
    selectedRoles.length > 0 ||
    selectedAssignees.length > 0 ||
    selectedYears.length > 0 ||
    selectedMonths.length > 0;

  // Load sprints and full role/assignee options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [sprintsRes, optionsRes] = await Promise.all([
          fetch('/api/sprints'),
          fetch('/api/individual-cr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
        ]);

        if (!sprintsRes.ok) throw new Error('Failed to load sprints');
        const sprintsData = await sprintsRes.json();
        setSprints(sprintsData.sprints || []);

        if (!optionsRes.ok) throw new Error('Failed to load filter options');
        const optionsData: IndividualCRResponse = await optionsRes.json();
        setAvailableRoles(optionsData.allRoles);
        setAvailableAssignees(optionsData.allAssignees);
      } catch (err) {
        console.error('Error loading filter options:', err);
        setError(`Error: ${String(err).replace('Error: ', '')}`);
      }
    };

    loadOptions();
  }, []);

  const handleClearFilters = () => {
    setSelectedSprints([]);
    setSelectedRoles([]);
    setSelectedAssignees([]);
    setSelectedYears([]);
    setSelectedMonths([]);
    setResults(null);
    setError(null);
  };

  // Handle generate
  const handleGenerate = async () => {
    if (!hasAnyFilter) {
      setError('Please select at least one filter');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/individual-cr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintIds: selectedSprints.length > 0 ? selectedSprints : undefined,
          roles: selectedRoles.length > 0 ? selectedRoles : undefined,
          assigneeNames: selectedAssignees.length > 0 ? selectedAssignees : undefined,
          years: selectedYears.length > 0 ? selectedYears : undefined,
          months: selectedMonths.length > 0 ? selectedMonths : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: IndividualCRResponse = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Error generating individual CR:', err);
      setError(`Error: ${String(err).replace('Error: ', '')}`);
    } finally {
      setLoading(false);
    }
  };

  // Convert to dropdown options
  const sprintOptions = sprints.map((s) => ({ value: s.id, label: s.id }));
  const roleOptions = availableRoles.map((r) => ({ value: r, label: r || '(Blank)' }));
  const assigneeOptions = availableAssignees.map((a) => ({ value: a, label: a }));
  const yearOptions = [...YEARS]
    .sort((a, b) => b - a)
    .map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-white mb-8">Individual Completion Rate</h1>

        {/* Error display */}
        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <p className="text-red-700">{error}</p>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-white">Filters</h2>
            <button
              type="button"
              onClick={handleClearFilters}
              disabled={!hasAnyFilter}
              className="text-xs text-cyan-300 hover:text-cyan-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {/* Filter grid: 2x3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <MultiSelectDropdown
              label="Sprint"
              options={sprintOptions}
              selected={selectedSprints}
              onChange={setSelectedSprints}
              disabled={false}
              placeholder="Select Sprint(s)"
            />

            <MultiSelectDropdown
              label="Role"
              options={roleOptions}
              selected={selectedRoles}
              onChange={setSelectedRoles}
              disabled={false}
              placeholder="All Roles"
            />

            <MultiSelectDropdown
              label="Assignee Name"
              options={assigneeOptions}
              selected={selectedAssignees}
              onChange={setSelectedAssignees}
              disabled={false}
              placeholder="All Assignees"
            />

            <MultiSelectDropdown
              label="Year"
              options={yearOptions}
              selected={selectedYears}
              onChange={setSelectedYears}
              disabled={false}
              placeholder="All Years"
            />

            <MultiSelectDropdown
              label="Month"
              options={MONTHS}
              selected={selectedMonths}
              onChange={setSelectedMonths}
              disabled={false}
              placeholder="All Months"
            />

            <div className="flex items-end">
              <GenerateButton
                onClick={handleGenerate}
                loading={loading}
                disabled={!hasAnyFilter}
              />
            </div>
          </div>
        </Card>

        {/* Loading spinner */}
        {loading && <LoadingSpinner />}

        {/* Results */}
        {results && results.assigneeStats.length > 0 && (
          <>
            <SummaryMetrics
              summary={{
                totalTasks: results.assigneeStats.reduce((sum, s) => sum + s.total, 0),
                totalCompleted: results.assigneeStats.reduce((sum, s) => sum + s.completed, 0),
                completionRate: Math.round(
                  (results.assigneeStats.reduce((sum, s) => sum + s.completed, 0) /
                    results.assigneeStats.reduce((sum, s) => sum + s.total, 0)) *
                    100 *
                    100
                ) / 100,
              }}
            />
            <Card>
              <h2 className="text-base font-bold text-white mb-6">Results</h2>
              <IndividualCRTable stats={results.assigneeStats} />
            </Card>
          </>
        )}

        {results && results.assigneeStats.length === 0 && (
          <Card>
            <p className="text-slate-300">No data found matching the selected filters.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
