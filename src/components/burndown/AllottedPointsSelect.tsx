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
      <label htmlFor="points-select" className="block text-sm font-medium text-gray-700">
        Allotted Points
      </label>
      <select
        id="points-select"
        value={selectedPoints ?? ''}
        onChange={(e) => onPointsChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 text-base text-gray-900 font-medium"
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
