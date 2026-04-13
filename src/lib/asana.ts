import { AsanaProject, AsanaTask, ProjectInfo } from '@/types/sync';

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';
const RATE_LIMIT_DELAY_MS = 100;

type LogFn = (message: string) => void;

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.ASANA_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a JS Date to MM/DD/YYYY in the configured timezone (America/Los_Angeles)
 * Matches GAS: Utilities.formatDate(date, Session.getScriptTimeZone(), "MM/dd/yyyy")
 */
function formatDateInTimezone(date: Date): string {
  const tz = process.env.TIMEZONE ?? 'America/Los_Angeles';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  const year = parts.find((p) => p.type === 'year')!.value;

  return `${month}/${day}/${year}`;
}

/**
 * Format an ISO date string (e.g. "2025-03-10T18:30:00.000Z") to MM/DD/YYYY
 * in the configured timezone. Matches GAS formatDateOnly().
 */
export function formatDateOnly(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return formatDateInTimezone(date);
}

/**
 * Fetch projects from the "(dept) Development" team in Asana (paginated).
 * Uses /teams/{team_gid}/projects for scoped results.
 * Falls back to workspace-level fetch if ASANA_TEAM_ID is not set.
 */
export async function fetchAsanaProjects(log?: LogFn): Promise<AsanaProject[]> {
  const teamId = process.env.ASANA_TEAM_ID;
  const workspaceId = process.env.ASANA_WORKSPACE_ID;
  const url = teamId
    ? `${ASANA_BASE_URL}/teams/${teamId}/projects?limit=100`
    : `${ASANA_BASE_URL}/workspaces/${workspaceId}/projects?limit=100`;
  const headers = getHeaders();

  const allProjects: AsanaProject[] = [];
  let nextPageUrl: string | null = null;
  let totalPages = 0;
  const maxPages = 20;

  do {
    const pageUrl: string = nextPageUrl ?? url;
    const response = await fetch(pageUrl, { method: 'GET', headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch projects: ${response.status} ${text}`);
    }

    const data = await response.json();
    allProjects.push(...data.data);
    totalPages++;
    nextPageUrl = data.next_page ? data.next_page.uri : null;

    if (log && totalPages > 1) {
      log(`Fetching projects from Asana... (page ${totalPages})`);
    }

    if (nextPageUrl) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  } while (nextPageUrl && totalPages < maxPages);

  return allProjects;
}

/**
 * Find a specific project by exact sprint name match.
 * Ports GAS lines 66-73.
 */
export async function findAsanaProject(
  sprintName: string,
  log?: LogFn,
): Promise<AsanaProject | null> {
  const projects = await fetchAsanaProjects(log);
  return projects.find((p) => p.name.trim() === sprintName.trim()) ?? null;
}

/**
 * Format an ISO date string (YYYY-MM-DD) to MM/DD/YYYY.
 * Handles date-only strings without time/timezone concerns.
 */
function formatISODateOnly(isoDateStr: string): string {
  const [year, month, day] = isoDateStr.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Fetch project details and parse sprint dates from the name.
 * Falls back to Asana's start_on/due_on fields if name doesn't match expected format.
 * Ports GAS lines 113-149.
 */
export async function getProjectDetails(
  projectGid: string,
): Promise<ProjectInfo | null> {
  const url = `${ASANA_BASE_URL}/projects/${projectGid}?opt_fields=name,gid,start_on,due_on`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    console.error(
      `Failed to fetch project details for ${projectGid}: ${response.status}`,
    );
    return null;
  }

  const project = (await response.json()).data;
  const match = project.name.match(
    /Sprint #(\d{4})\.Q(\d)\.S(\d+).*?\((\d{2})(\d{2})-(\d{2})(\d{2})\)/,
  );

  if (match) {
    const year = parseInt(match[1]);
    const startMonth = parseInt(match[4]);
    const startDay = parseInt(match[5]);
    const endMonth = parseInt(match[6]);
    const endDay = parseInt(match[7]);

    return {
      gid: project.gid,
      title: project.name,
      startDate: `${match[4]}/${match[5]}/${year}`,
      endDate: `${match[6]}/${match[7]}/${year}`,
    };
  }

  // Fallback to Asana's start_on/due_on if name doesn't match expected format
  if (project.start_on && project.due_on) {
    return {
      gid: project.gid,
      title: project.name,
      startDate: formatISODateOnly(project.start_on),
      endDate: formatISODateOnly(project.due_on),
    };
  }

  return {
    gid: project.gid,
    title: project.name,
    startDate: 'Unknown',
    endDate: 'Unknown',
  };
}

/**
 * Fetch all tasks for a project (paginated).
 * Ports GAS lines 193-215.
 */
export async function fetchProjectTasks(
  projectGid: string,
  log?: LogFn,
): Promise<AsanaTask[]> {
  const url = `${ASANA_BASE_URL}/projects/${projectGid}/tasks?opt_fields=name,permalink_url,assignee.name,created_at,completed_at,completed,custom_fields&limit=100`;
  const headers = getHeaders();

  const allTasks: AsanaTask[] = [];
  let nextPageUrl: string | null = null;
  let totalPages = 0;
  const maxPages = 10;

  do {
    const pageUrl: string = nextPageUrl ?? url;
    const response: Response = await fetch(pageUrl, { method: 'GET', headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch tasks: ${response.status} ${text}`);
    }

    const responseData: { data: AsanaTask[]; next_page: { uri: string } | null } =
      await response.json();
    allTasks.push(...responseData.data);
    totalPages++;
    nextPageUrl = responseData.next_page ? responseData.next_page.uri : null;

    if (log) {
      log(`Fetching tasks from Asana... (page ${totalPages})`);
    }

    if (nextPageUrl) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  } while (nextPageUrl && totalPages < maxPages);

  return allTasks;
}
