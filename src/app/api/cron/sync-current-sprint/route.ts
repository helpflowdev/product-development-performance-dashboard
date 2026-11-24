import { handleScheduledSync } from '@/lib/scheduled-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/sync-current-sprint
 * Called by Vercel Cron (schedule in vercel.json) to sync the current sprint from
 * Asana into the sheet. See src/lib/scheduled-sync.ts.
 */
export function GET(request: Request): Promise<Response> {
  return handleScheduledSync(request, 'current');
}
