import { handleScheduledSync } from '@/lib/scheduled-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/sync-previous-sprint
 * Called on a schedule (.github/workflows/scheduled-sync.yml) to sync the previous sprint from
 * Asana into the sheet. See src/lib/scheduled-sync.ts.
 */
export function GET(request: Request): Promise<Response> {
  return handleScheduledSync(request, 'previous');
}
