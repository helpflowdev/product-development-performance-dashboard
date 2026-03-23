'use client';

import { QAFlag, QAFlagType } from '@/types/burndown';
import { Badge } from '@/components/ui/Badge';

interface QALogPanelProps {
  flags: QAFlag[];
}

export function QALogPanel({ flags }: QALogPanelProps) {
  const errorCount = flags.filter((f) => f.type.includes('missing')).length;
  const warningCount = flags.filter((f) => f.type === 'date_outside_sprint').length;
  const infoCount = flags.filter((f) => f.type === 'incomplete_missing_story_points').length;

  if (flags.length === 0) {
    return (
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-800 font-medium">✓ No data issues found</p>
      </div>
    );
  }

  const flagsByType = flags.reduce(
    (acc, flag) => {
      if (!acc[flag.type]) acc[flag.type] = [];
      acc[flag.type].push(flag);
      return acc;
    },
    {} as Record<QAFlagType, QAFlag[]>
  );

  return (
    <div className="mt-6 border border-gray-200 rounded-lg p-4">
      <div className="flex gap-4 mb-4">
        {errorCount > 0 && <Badge label={`${errorCount} Errors`} variant="error" />}
        {warningCount > 0 && <Badge label={`${warningCount} Warnings`} variant="warning" />}
        {infoCount > 0 && <Badge label={`${infoCount} Info`} variant="info" />}
      </div>

      <div className="space-y-3">
        {flagsByType['complete_missing_date'] && (
          <details className="border-b pb-3">
            <summary className="cursor-pointer font-semibold text-red-700">
              Complete but missing burndown date ({flagsByType['complete_missing_date'].length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {flagsByType['complete_missing_date'].map((flag, idx) => (
                <li key={idx}>
                  • {flag.taskTitle} ({flag.assignee})
                </li>
              ))}
            </ul>
          </details>
        )}

        {flagsByType['complete_missing_story_points'] && (
          <details className="border-b pb-3">
            <summary className="cursor-pointer font-semibold text-red-700">
              Complete but missing story points ({flagsByType['complete_missing_story_points'].length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {flagsByType['complete_missing_story_points'].map((flag, idx) => (
                <li key={idx}>
                  • {flag.taskTitle} ({flag.assignee})
                </li>
              ))}
            </ul>
          </details>
        )}

        {flagsByType['date_outside_sprint'] && (
          <details className="border-b pb-3">
            <summary className="cursor-pointer font-semibold text-yellow-700">
              Date outside sprint window ({flagsByType['date_outside_sprint'].length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {flagsByType['date_outside_sprint'].map((flag, idx) => (
                <li key={idx}>
                  • {flag.taskTitle} (completed {flag.date})
                </li>
              ))}
            </ul>
          </details>
        )}

        {flagsByType['incomplete_missing_story_points'] && (
          <details className="pb-3">
            <summary className="cursor-pointer font-semibold text-blue-700">
              Incomplete missing story points ({flagsByType['incomplete_missing_story_points'].length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {flagsByType['incomplete_missing_story_points'].map((flag, idx) => (
                <li key={idx}>
                  • {flag.taskTitle} ({flag.assignee})
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
