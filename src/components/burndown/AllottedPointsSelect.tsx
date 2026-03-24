const ALLOTTED_POINTS_OPTIONS = [1600, 1800, 2000, 2200];

interface AllottedPointsSelectProps {
  selectedPoints: number | null;
  onPointsChange: (points: number) => void;
  disabled?: boolean;
}

export function AllottedPointsSelect({
  selectedPoints,
  onPointsChange,
  disabled = false,
}: AllottedPointsSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="points-select" className="block text-sm font-medium text-slate-300">
        Allotted Points
      </label>
      <select
        id="points-select"
        value={selectedPoints ?? ''}
        onChange={(e) => onPointsChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="glass-input px-4 py-3 rounded-lg text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">-- Choose points --</option>
        {ALLOTTED_POINTS_OPTIONS.map((points) => (
          <option key={points} value={points}>
            {points} points
          </option>
        ))}
      </select>
    </div>
  );
}
