/**
 * Generate the short AI narratives for the Sprint Summary ("what did this sprint
 * focus on") and the Weekly Scorecard ("why did the numbers move"), using the
 * Google Gemini API (free tier via Google AI Studio).
 *
 * Model selection is deliberately defensive, because the set of models a key can
 * use — and the free-tier quota attached to each — changes without notice:
 *
 *   - GEMINI_MODEL pins one model and skips discovery entirely.
 *   - Otherwise the API is asked which models the key can use, and the candidates
 *     are ranked: known-good free-tier flash models first, then by parsed version
 *     number. NOT by lexical sort — that ranks "gemini-omni-1.1-flash" above
 *     "gemini-2.5-flash" because 'o' (111) > '2' (50), which is how this code
 *     used to land on a model with no free-tier quota and fail every request.
 *   - A candidate that fails with a retryable status (429 quota, 404/403 no
 *     access, 5xx) falls through to the next one instead of giving up.
 *
 * Never throws — returns { summary, error }, where `error` is a short
 * human-readable reason (surfaced in the UI) so a misconfiguration isn't a silent
 * empty box. Quota failures report the quotaId, limit and retryDelay parsed out
 * of the response instead of a JSON blob truncated mid-word.
 *
 * Uses the REST endpoint directly (no SDK dependency). Auth is the AI Studio API
 * key via the x-goog-api-key header.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_TITLES = 400; // keep the prompt bounded for very large sprints
const TIMEOUT_MS = 30000; // overall budget, shared across fallback attempts
const MAX_ATTEMPTS = 4; // cap fallbacks so a dead key fails fast

/**
 * Models known to be broadly available on the AI Studio free tier, best first.
 * Only ever used as an ordering hint over what the API says the key can use, so
 * a stale entry here is skipped rather than causing a 404.
 */
const PREFERRED_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

/** Statuses where a different model plausibly succeeds. */
const RETRYABLE_STATUSES = new Set([403, 404, 429, 500, 502, 503]);

const SYSTEM_PROMPT = [
  "You summarize a software team's sprint.",
  'Given the titles of the tasks worked on during a sprint (recurring/daily tasks',
  'already excluded), write a concise 2–4 sentence summary of what the team focused',
  'on, grouped by theme where natural (e.g. development work, improvements, bug',
  'fixes, or a specific product/client). Do not list every task, and do not invent',
  'work that the titles do not imply. Respond with only the summary prose — no',
  'preamble, headings, bullet points, or meta-commentary.',
].join(' ');

/**
 * System prompt for the Weekly Scorecard's analytical narrative. Unlike the
 * focus summary (which answers "what was worked on"), this answers "why the
 * numbers moved" — grounded only in the metrics handed in.
 */
const SCORECARD_SYSTEM_PROMPT = [
  "You are writing the analytical summary for a software team's weekly leadership",
  'scorecard. You are given the computed metrics for one sprint (completion rate',
  'this sprint vs. quarter-to-date, developers vs. whole-team completion, story-point',
  'burndown, and optionally hours). Write a concise 3–5 sentence analysis of what the',
  'numbers indicate and the likely drivers (team capacity, time off/UTOs, scope added',
  'mid-sprint, estimation accuracy) — framed for leadership. Only reason from the',
  'numbers provided; do not invent specific tasks, names, or events the numbers do not',
  'imply, and do not simply restate every figure. Respond with only the analysis prose',
  '— no preamble, headings, bullet points, or meta-commentary.',
].join(' ');

export interface FocusResult {
  summary: string | null;
  error: string | null; // short reason when summary is null (null when no key)
}

interface ModelEntry {
  name?: string;
  supportedGenerationMethods?: string[];
}

/** Shape of a Gemini error envelope; every field is best-effort. */
interface GeminiErrorBody {
  error?: {
    message?: string;
    status?: string;
    details?: Array<{
      retryDelay?: string;
      violations?: Array<{ quotaId?: string; quotaValue?: string }>;
    }>;
  };
}

// Cached across invocations in the same serverless instance (set only on success).
let cachedModel: string | null = null;

function snippet(s: string, max = 200): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Sortable version number from a model name: "gemini-2.5-flash" → 2005. */
function versionOf(name: string): number {
  const m = /(\d+)\.(\d+)/.exec(name);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : -1;
}

function dedupe(names: string[]): string[] {
  return [...new Set(names)];
}

/**
 * Turn a failed response into a one-line reason. For quota failures this pulls
 * the quotaId / limit / retryDelay out of the QuotaFailure and RetryInfo details,
 * which is what actually distinguishes "this model has no free-tier allowance"
 * from "you've used up today's requests".
 */
function describeApiError(status: number, body: string): string {
  let parsed: GeminiErrorBody | null = null;
  try {
    parsed = JSON.parse(body) as GeminiErrorBody;
  } catch {
    // Not JSON — fall through to the raw body.
  }

  const err = parsed?.error;
  if (!err) return `HTTP ${status}: ${snippet(body)}`;

  const parts = [`HTTP ${status}`];
  if (err.status) parts.push(err.status);

  const details = err.details ?? [];
  const violation = details.flatMap((d) => d.violations ?? [])[0];
  if (violation?.quotaId) {
    parts.push(
      violation.quotaValue !== undefined
        ? `quota ${violation.quotaId} (limit ${violation.quotaValue})`
        : `quota ${violation.quotaId}`,
    );
  }

  const retryDelay = details.find((d) => d.retryDelay)?.retryDelay;
  if (retryDelay) parts.push(`retry in ${retryDelay}`);

  // The prose on a quota failure is boilerplate ("check your plan and billing
  // details…") and would crowd out the other models' reasons, so it's only worth
  // showing when the structured quota fields told us nothing.
  if (err.message && !violation?.quotaId) parts.push(snippet(err.message, 120));

  return parts.join(' — ');
}

/**
 * Ordered list of models to try. Honors GEMINI_MODEL strictly — a deliberate pin
 * skips discovery so its behaviour stays predictable — else discovers and ranks
 * what the key can actually use.
 */
async function resolveCandidates(
  apiKey: string,
  signal: AbortSignal,
): Promise<{ candidates: string[]; error: string | null }> {
  if (process.env.GEMINI_MODEL) {
    return { candidates: [process.env.GEMINI_MODEL], error: null };
  }

  const res = await fetch(`${API_BASE}/models`, {
    headers: { 'x-goog-api-key': apiKey },
    signal,
  });
  if (!res.ok) {
    return {
      candidates: [],
      error: `Couldn't list Gemini models (${describeApiError(
        res.status,
        await res.text().catch(() => ''),
      )}). Check the API key.`,
    };
  }

  const models = (((await res.json()) as { models?: ModelEntry[] }).models ?? []).filter((m) =>
    (m.supportedGenerationMethods ?? []).includes('generateContent'),
  );
  const usable = models.map((m) => (m.name ?? '').replace(/^models\//, '')).filter(Boolean);

  const stableFlash = usable.filter((n) => /flash/i.test(n) && !/(exp|preview|thinking)/i.test(n));
  const preferred = PREFERRED_MODELS.filter((n) => stableFlash.includes(n));
  const restStableFlash = stableFlash
    .filter((n) => !preferred.includes(n))
    .sort((a, b) => versionOf(b) - versionOf(a) || a.localeCompare(b));

  // Widen progressively: known-good → other stable flash → any flash → anything.
  const candidates = dedupe([
    ...(cachedModel ? [cachedModel] : []),
    ...preferred,
    ...restStableFlash,
    ...usable.filter((n) => /flash/i.test(n)),
    ...usable,
  ]);

  if (candidates.length === 0) {
    return {
      candidates: [],
      error: 'No Gemini model available to this key supports text generation.',
    };
  }
  return { candidates, error: null };
}

interface GenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

/**
 * Shared request loop for both narrative types: try each candidate model in
 * turn, falling through on retryable failures, and report every failure if none
 * succeed.
 */
async function generate(
  systemPrompt: string,
  userText: string,
  logTag: string,
): Promise<FocusResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { summary: null, error: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { candidates, error } = await resolveCandidates(apiKey, controller.signal);
    if (candidates.length === 0) return { summary: null, error };

    const attempts = candidates.slice(0, MAX_ATTEMPTS);
    const failures: string[] = [];

    for (const model of attempts) {
      const response = await fetch(`${API_BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          // Generous cap: newer models spend part of the budget on internal
          // reasoning and return empty text if it only covers the thinking.
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = describeApiError(response.status, await response.text().catch(() => ''));
        console.error(`[${logTag}] Gemini "${model}" failed: ${detail}`);
        failures.push(`"${model}" ${detail}`);
        if (cachedModel === model) cachedModel = null; // don't keep preferring it
        if (RETRYABLE_STATUSES.has(response.status)) continue;
        break; // e.g. a malformed request — another model won't help
      }

      const data = (await response.json()) as GenerateResponse;
      const candidate = data.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim();

      if (!text) {
        const reason = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason})` : '';
        console.error(`[${logTag}] Gemini "${model}" returned no text${reason}`);
        failures.push(`"${model}" returned no text${reason}`);
        if (cachedModel === model) cachedModel = null;
        continue;
      }

      cachedModel = model; // remember the working model
      return { summary: text, error: null };
    }

    const tried = failures.length === 1 ? 'Gemini' : `Gemini (tried ${failures.length} models)`;
    return { summary: null, error: snippet(`${tried}: ${failures.join('; ')}`, 400) };
  } catch (err) {
    const msg = controller.signal.aborted ? 'Gemini request timed out.' : String(err);
    console.error(`[${logTag}] generation failed:`, err);
    return { summary: null, error: snippet(msg) };
  } finally {
    clearTimeout(timer);
  }
}

/** Metrics fed to the scorecard narrative generator. */
export interface ScorecardNarrativeInput {
  sprintId: string;
  completionRate: number;
  completionGoal: number;
  qtdCompletionRate: number | null;
  devsCompletionRate: number;
  teamCompletionRate: number;
  allottedStoryPoints: number;
  consumedStoryPoints: number;
  burndownRate: number;
  totalHoursEstimate?: number;
  totalHoursActual?: number;
}

/**
 * Generate the Weekly Scorecard's analytical "why the numbers moved" narrative
 * via Gemini. Never throws; returns { summary: null, error: null } when no
 * GEMINI_API_KEY is configured.
 */
export async function generateScorecardNarrative(
  input: ScorecardNarrativeInput,
): Promise<FocusResult> {
  const qtd = input.qtdCompletionRate !== null ? `${input.qtdCompletionRate.toFixed(2)}%` : 'n/a';
  const hoursLine =
    input.totalHoursEstimate !== undefined && input.totalHoursActual !== undefined
      ? `\n- Hours (actual / estimate): ${input.totalHoursActual} / ${input.totalHoursEstimate}`
      : '';

  const metrics = [
    `Sprint: ${input.sprintId}`,
    `Completion rate this sprint: ${input.completionRate.toFixed(2)}% (goal ${input.completionGoal}%)`,
    `Completion rate quarter-to-date: ${qtd}`,
    `Developers completion rate: ${input.devsCompletionRate.toFixed(2)}%`,
    `Whole-team completion rate: ${input.teamCompletionRate.toFixed(2)}%`,
    `Story points consumed / allotted: ${input.consumedStoryPoints} / ${input.allottedStoryPoints}`,
    `Story-point burndown rate: ${input.burndownRate.toFixed(2)}%`,
  ].join('\n- ');

  return generate(
    SCORECARD_SYSTEM_PROMPT,
    `Metrics:\n- ${metrics}${hoursLine}`,
    'scorecard-narrative',
  );
}

export async function generateFocusSummary(
  sprintName: string,
  taskTitles: string[],
): Promise<FocusResult> {
  const titles = taskTitles
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TITLES);
  if (titles.length === 0) return { summary: null, error: null };

  return generate(
    SYSTEM_PROMPT,
    `Sprint: ${sprintName}\n\nTask titles:\n- ${titles.join('\n- ')}`,
    'sprint-focus-summary',
  );
}
