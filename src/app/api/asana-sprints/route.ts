import { NextResponse } from 'next/server';
import { fetchAsanaProjects } from '@/lib/asana';

/**
 * Parse a sprint name into a sortable key.
 * e.g. "Sprint #2025.Q1.S3 (0205-0218)" → "2025.1.03.0205"
 * Higher key = more recent sprint.
 */
function sprintSortKey(name: string): string {
  const match = name.match(
    /Sprint #(\d{4})\.Q(\d)\.S(\d+).*?\((\d{4})-/,
  );
  if (!match) return '0000.0.00.0000';
  const [, year, quarter, sprint, startDate] = match;
  return `${year}.${quarter}.${sprint.padStart(2, '0')}.${startDate}`;
}

/**
 * GET /api/asana-sprints
 * Returns sprints from the (dept) Development team,
 * sorted descending (latest sprint first).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const allProjects = await fetchAsanaProjects();

    // Filter to only sprint projects and sort latest first
    const sprintPattern = /^Sprint #\d{4}\.Q\d\.S\d+/;
    const sprints = allProjects
      .filter((p) => sprintPattern.test(p.name))
      .sort((a, b) => sprintSortKey(b.name).localeCompare(sprintSortKey(a.name)));

    return NextResponse.json({ sprints });
  } catch (error) {
    console.error('[GET /api/asana-sprints]', error);
    return NextResponse.json(
      { error: `Failed to fetch Asana sprints: ${String(error)}` },
      { status: 500 },
    );
  }
}
