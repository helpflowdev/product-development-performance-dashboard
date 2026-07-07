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
 * Resolve the workspace (organization) gid for workspace-wide search. Prefers
 * ASANA_WORKSPACE_ID, but falls back to deriving it from the configured
 * ASANA_TEAM_ID's organization — so the search works in deployments that only
 * set ASANA_TEAM_ID (the common case here). Returns null if neither resolves.
 */
async function resolveWorkspaceId(): Promise<string | null> {
  const workspaceId = process.env.ASANA_WORKSPACE_ID;
  if (workspaceId) return workspaceId;

  const teamId = process.env.ASANA_TEAM_ID;
  if (!teamId) return null;

  const url = `${ASANA_BASE_URL}/teams/${teamId}?opt_fields=organization.gid`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!response.ok) return null;

  const data = await response.json();
  return data.data?.organization?.gid ?? null;
}

/**
 * Find a project by exact name across the ENTIRE workspace via Asana's
 * typeahead search (not scoped to a team). This reaches sprint projects that
 * haven't been added to the (dept) Development team yet — which the team-scoped
 * fetchAsanaProjects() / findAsanaProject() cannot see. Returns the project
 * whose name matches exactly (after trim), or null.
 */
export async function findProjectInWorkspace(
  sprintName: string,
  log?: LogFn,
): Promise<AsanaProject | null> {
  const workspaceId = await resolveWorkspaceId();
  if (!workspaceId) return null;

  const target = sprintName.trim();
  const query = encodeURIComponent(target);
  const url = `${ASANA_BASE_URL}/workspaces/${workspaceId}/typeahead?resource_type=project&count=20&opt_fields=name&query=${query}`;
  const response = await fetch(url, { method: 'GET', headers: getHeaders() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to search workspace projects: ${response.status} ${text}`,
    );
  }

  const data = await response.json();
  const match =
    (data.data as AsanaProject[]).find((p) => p.name.trim() === target) ?? null;
  if (match && log) log(`Found "${match.name}" in the workspace.`);
  return match;
}

/**
 * Set a project's owning team. Used to pull a sprint project into the
 * (dept) Development team so the dashboard's team-scoped fetch can see it.
 * Idempotent — setting the same team again is a no-op on Asana's side.
 */
export async function assignProjectToTeam(
  projectGid: string,
  teamId: string,
): Promise<void> {
  const url = `${ASANA_BASE_URL}/projects/${projectGid}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ data: { team: teamId } }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to assign project to team: ${response.status} ${text}`,
    );
  }
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
 * Outcome of an added-to-project lookup. `date` is '' unless a matching event
 * was found. `error` is set only when the lookup call itself failed — this lets
 * the caller distinguish "this task genuinely has no add-event" (date '', no
 * error) from "the API call failed" (error set), which otherwise look identical.
 */
export interface AddedDateResult {
  date: string;
  error?: string;
}

/**
 * Find when a task was added to a specific project ("Date Added to Sprint").
 *
 * Asana's task fetch doesn't expose project-membership dates, so we read the
 * task's stories (activity log) and find the `added_to_project` system story
 * that references this project. Stories come back oldest-first, so the early
 * "added to project" event is reliably within the first page.
 *
 * Never throws. Retries once on HTTP 429 honoring Retry-After. The caller
 * (sync-engine) paces these in bounded concurrent batches.
 */
export async function fetchTaskAddedToProjectDate(
  taskGid: string,
  projectTitle: string,
): Promise<AddedDateResult> {
  const url = `${ASANA_BASE_URL}/tasks/${taskGid}/stories?opt_fields=resource_subtype,created_at,text&limit=100`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { method: 'GET', headers: getHeaders() });

      if (response.status === 429 && attempt === 0) {
        const retryAfter = Number(response.headers.get('Retry-After')) || 1;
        await sleep(Math.min(retryAfter, 5) * 1000);
        continue; // retry once
      }
      if (!response.ok) return { date: '', error: `HTTP ${response.status}` };

      const stories = ((await response.json()).data ?? []) as Array<{
        resource_subtype?: string;
        created_at: string;
        text?: string;
      }>;

      const additions = stories.filter(
        (s) => s.resource_subtype === 'added_to_project',
      );

      // Prefer the addition story that names THIS project (a task can belong to
      // several projects). Fall back to the sole addition story if there's only
      // one — story text phrasing varies across Asana versions.
      let candidates = additions.filter((s) => s.text?.includes(projectTitle));
      if (candidates.length === 0 && additions.length === 1) {
        candidates = additions;
      }
      if (candidates.length === 0) return { date: '' }; // no add-event for this task

      // Most recent addition wins (handles remove → re-add to the same project).
      const latest = candidates.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b,
      );

      return { date: formatDateOnly(latest.created_at) };
    } catch (e) {
      return { date: '', error: String(e) };
    }
  }

  return { date: '', error: 'HTTP 429 (retries exhausted)' };
}

// ─── Write operations (used by Sprint Summary → Asana) ───────────────────────

/** Outcome of a single comment post. `error` carries Asana's response text. */
export interface PostCommentResult {
  success: boolean;
  error?: string;
}

/**
 * Create a task in the given project and return its gid + permalink.
 * Optionally sets an assignee (user gid) and a due date (YYYY-MM-DD).
 */
export async function createAsanaTask(
  projectGid: string,
  name: string,
  opts: { assignee?: string; dueOn?: string } = {},
): Promise<{ gid: string; permalinkUrl: string }> {
  const url = `${ASANA_BASE_URL}/tasks?opt_fields=permalink_url,name`;
  const data: Record<string, unknown> = { name, projects: [projectGid] };
  if (opts.assignee) data.assignee = opts.assignee;
  if (opts.dueOn) data.due_on = opts.dueOn;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ data }),
  });

  const json = await response.json().catch(() => ({}));
  if (response.status !== 201) {
    const message = json?.errors?.[0]?.message ?? `HTTP ${response.status}`;
    throw new Error(`Failed to create Asana task: ${message}`);
  }

  const gid = json.data.gid as string;
  // permalink_url is returned thanks to opt_fields; fall back to a constructed URL.
  const permalinkUrl =
    (json.data.permalink_url as string | undefined) ??
    `https://app.asana.com/0/0/${gid}`;
  return { gid, permalinkUrl };
}

/**
 * Create a task as a SUBTASK of an existing parent task and return its gid +
 * permalink. Same request/parse shape as createAsanaTask, but posts `parent`
 * instead of `projects` so the new task collects under a standing parent task
 * (e.g. "DEV - End of Sprint Summary" / "Dev - Weekly Scorecard Report") rather
 * than landing as a standalone task in a project. Optionally sets an assignee
 * (user gid) and a due date (YYYY-MM-DD).
 */
export async function createAsanaSubtask(
  parentGid: string,
  name: string,
  opts: { assignee?: string; dueOn?: string; followers?: string[] } = {},
): Promise<{ gid: string; permalinkUrl: string }> {
  const url = `${ASANA_BASE_URL}/tasks?opt_fields=permalink_url,name`;
  const data: Record<string, unknown> = { name, parent: parentGid };
  if (opts.assignee) data.assignee = opts.assignee;
  if (opts.dueOn) data.due_on = opts.dueOn;
  // Followers = the Asana equivalent of "cc": they're notified and can watch the
  // task. Bad gids would fail the whole create, so callers pass verified gids.
  if (opts.followers && opts.followers.length > 0) data.followers = opts.followers;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ data }),
  });

  const json = await response.json().catch(() => ({}));
  if (response.status !== 201) {
    const message = json?.errors?.[0]?.message ?? `HTTP ${response.status}`;
    throw new Error(`Failed to create Asana subtask: ${message}`);
  }

  const gid = json.data.gid as string;
  const permalinkUrl =
    (json.data.permalink_url as string | undefined) ??
    `https://app.asana.com/0/0/${gid}`;
  return { gid, permalinkUrl };
}

/**
 * Post a single comment (story) to a task. Never throws — returns a result
 * carrying Asana's error text on failure (so callers can detect "too large").
 * Options: `asHtml` sends Asana rich text (`html_text`, wrapped in <body>…</body>)
 * instead of plain `text`; `pinned` pins the comment to the top of the task.
 */
export async function postCommentToTask(
  taskGid: string,
  comment: string,
  opts: { asHtml?: boolean; pinned?: boolean } = {},
): Promise<PostCommentResult> {
  if (!comment || !comment.trim()) {
    return { success: false, error: 'Empty comment' };
  }

  const data: Record<string, unknown> = opts.asHtml
    ? { html_text: comment }
    : { text: comment };
  if (opts.pinned) data.is_pinned = true;

  try {
    const response = await fetch(`${ASANA_BASE_URL}/tasks/${taskGid}/stories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ data }),
    });

    if (response.status !== 201) {
      return { success: false, error: await response.text() };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Byte length under the script's convention: ASCII = 1 byte, anything else = 2.
 * (Approximate, but matches the GAS getByteLength used to size comment chunks.)
 */
function getByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    bytes += str.charCodeAt(i) < 128 ? 1 : 2;
  }
  return bytes;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A task shown as a hyperlinked title (or plain title when it has no URL). */
export interface GroupTask {
  title: string;
  url: string;
}

/** Tasks for one assignee within a list. */
export interface TaskGroup {
  assignee: string;
  tasks: GroupTask[];
}

/** Render a single <li> for a task — hyperlinked when it has a URL. */
function renderTaskItem(t: GroupTask): string {
  const title = escapeHtml(t.title);
  return t.url
    ? `<li><a href="${escapeHtml(t.url)}">${title}</a></li>`
    : `<li>${title}</li>`;
}

/** Render one assignee group: "<strong>Name (n):</strong><ol>…</ol>". */
function renderGroup(assignee: string, tasks: GroupTask[]): string {
  const items = tasks.map(renderTaskItem).join('');
  return `<strong>${escapeHtml(assignee)} (${tasks.length}):</strong><ol>${items}</ol>`;
}

/**
 * Build the Asana rich-text (`html_text`) comment bodies for a grouped task list.
 * Pure (no I/O) so it can be unit-tested. Packs whole assignee groups into
 * byte-bounded chunks (Asana rejects oversized comments); a single group too
 * large for one comment is split across comments by its items (header repeats).
 * Each returned string is a complete <body>…</body> ready to post. Empty groups
 * are dropped; an empty/all-empty input yields [].
 */
export function buildGroupedListHtmlChunks(
  label: string,
  groups: TaskGroup[],
): string[] {
  const nonEmpty = groups.filter((g) => g.tasks.length > 0);
  if (nonEmpty.length === 0) return [];

  // Leave headroom under the 50 KB comment limit for the <body> + label wrapper.
  const MAX_BYTES = 45000;

  // Turn groups into rendered fragments, splitting any single oversized group.
  const fragments: string[] = [];
  for (const g of nonEmpty) {
    const full = renderGroup(g.assignee, g.tasks);
    if (getByteLength(full) <= MAX_BYTES) {
      fragments.push(full);
      continue;
    }
    // Oversized single group: chunk its items (header repeats each part).
    let batch: GroupTask[] = [];
    let batchSize = 0;
    const flush = () => {
      if (batch.length) fragments.push(renderGroup(g.assignee, batch));
      batch = [];
      batchSize = 0;
    };
    for (const t of g.tasks) {
      const size = getByteLength(renderTaskItem(t));
      if (batchSize + size > MAX_BYTES && batch.length) flush();
      batch.push(t);
      batchSize += size;
    }
    flush();
  }

  // Pack fragments into chunks under the limit.
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentSize = 0;
  for (const frag of fragments) {
    const size = getByteLength(frag);
    if (currentSize + size > MAX_BYTES && current.length) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(frag);
    currentSize += size;
  }
  if (current.length) chunks.push(current);

  const total = chunks.length;
  return chunks.map((frags, i) => {
    const part = total > 1 ? ` (Part ${i + 1} of ${total})` : '';
    return `<body><strong>${escapeHtml(label)}${part}</strong>${frags.join('')}</body>`;
  });
}

/**
 * Post grouped, per-assignee task lists to a task as Asana rich-text comments
 * (hyperlinked titles). Returns the number of comments successfully posted.
 */
export async function postGroupedTaskListInChunks(
  taskGid: string,
  label: string,
  groups: TaskGroup[],
): Promise<number> {
  const chunks = buildGroupedListHtmlChunks(label, groups);
  let posted = 0;

  for (let i = 0; i < chunks.length; i++) {
    let success = false;
    for (let retry = 0; retry < 3 && !success; retry++) {
      const result = await postCommentToTask(taskGid, chunks[i], { asHtml: true });
      if (result.success) {
        success = true;
        posted++;
      } else if (retry < 2) {
        await sleep(2000);
      }
    }
    if (i < chunks.length - 1) await sleep(1000);
  }

  return posted;
}

/**
 * Fetch all tasks for a project (paginated).
 * Ports GAS lines 193-215.
 */
export async function fetchProjectTasks(
  projectGid: string,
  log?: LogFn,
): Promise<AsanaTask[]> {
  const url = `${ASANA_BASE_URL}/projects/${projectGid}/tasks?opt_fields=name,permalink_url,assignee.name,created_at,completed_at,completed,due_on,custom_fields&limit=100`;
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

/**
 * Fetch each task's Asana due date ("due_on") for a sprint, keyed by the task's
 * permalink URL (which matches the sheet's "Link to Task" column). Used by the
 * Weekly Scorecard's running/to-date completion rate — due dates aren't synced
 * into the sheet, so we read them live from Asana for the selected sprint only.
 *
 * Resolves the sprint's Asana project by exact name — the workspace typeahead
 * first (one cheap call), falling back to the team-scoped project list. Returns
 * an empty map if the project can't be found or has no tasks; the value is '' for
 * a task with no due date set. Never throws for a missing project — callers treat
 * an empty map as "no due dates available".
 */
export async function fetchSprintTaskDueDates(
  sprintName: string,
  log?: LogFn,
): Promise<Map<string, string>> {
  const project =
    (await findProjectInWorkspace(sprintName, log)) ??
    (await findAsanaProject(sprintName, log));

  const dueByLink = new Map<string, string>();
  if (!project) return dueByLink;

  const tasks = await fetchProjectTasks(project.gid, log);
  for (const t of tasks) {
    if (t.permalink_url) dueByLink.set(t.permalink_url, t.due_on ?? '');
  }
  return dueByLink;
}
