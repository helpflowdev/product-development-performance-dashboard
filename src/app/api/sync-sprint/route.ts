import { NextRequest } from 'next/server';
import { syncSprintData } from '@/lib/sync-engine';
import { SyncRequest } from '@/types/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/sync-sprint
 * Streams SSE progress events while syncing Asana tasks to Google Sheets.
 *
 * Request body: { sprintName: string }
 * Response: text/event-stream with progress events and a final done/error event.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let body: SyncRequest;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!body.sprintName || typeof body.sprintName !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid sprintName' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sprintName = body.sprintName.trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      function log(message: string) {
        sendEvent('progress', { message });
      }

      try {
        const result = await syncSprintData(sprintName, log);

        if (result.success) {
          sendEvent('done', result);
        } else {
          sendEvent('error', { error: result.error, ...result });
        }
      } catch (error) {
        sendEvent('error', { error: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
