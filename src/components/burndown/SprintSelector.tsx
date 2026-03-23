import { SprintMeta } from '@/types/sprint';

interface SprintSelectorProps {
  sprints: SprintMeta[];
  selectedSprint: string;
  onSprintChange: (sprintId: string) => void;
  disabled?: boolean;
}

export function SprintSelector({
  sprints,
  selectedSprint,
  onSprintChange,
  disabled = false,
}: SprintSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="sprint-select" className="block text-sm font-medium text-gray-700">
        Select Sprint
      </label>
      <select
        id="sprint-select"
        value={selectedSprint}
        onChange={(e) => onSprintChange(e.target.value)}
        disabled={disabled}
        className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 text-base text-gray-900 font-medium"
      >
        <option value="">-- Choose a sprint --</option>
        {sprints.map((sprint) => (
          <option key={sprint.id} value={sprint.id}>
            {sprint.id}
          </option>
        ))}
      </select>
    </div>
  );
}
