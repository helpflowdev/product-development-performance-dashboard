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
      <label htmlFor="sprint-select" className="block text-sm font-medium text-slate-300">
        Select Sprint
      </label>
      <select
        id="sprint-select"
        value={selectedSprint}
        onChange={(e) => onSprintChange(e.target.value)}
        disabled={disabled}
        className="glass-input px-4 py-3 rounded-lg text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
