import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Simple healthcheck endpoint for Railway
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
