/**
 * Generate a short "what did this sprint focus on" summary from task titles,
 * using the Google Gemini API (free tier via Google AI Studio). Recurring/daily
 * tasks are excluded by the caller — only real deliverables are passed in.
 *
 * Robust to model churn: unless GEMINI_MODEL is set, it asks the API which models
 * the key can use and picks an available "flash" model that supports
 * generateContent. Never throws — returns { summary, error }, where `error` is a
 * short human-readable reason (surfaced in the UI) so a misconfiguration isn't a
 * silent empty box.
 *
 * Uses the REST endpoint directly (no SDK dependency). Auth is the AI Studio API
 * key via the x-goog-api-key header.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_TITLES = 400; // keep the prompt bounded for very large sprints
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = [
  "You summarize a software team's sprint.",
  'Given the titles of the tasks worked on during a sprint (recurring/daily tasks',
  'already excluded), write a concise 2–4 sentence summary of what the team focused',
  'on, grouped by theme where natural (e.g. development work, improvements, bug',
  'fixes, or a specific product/client). Do not list every task, and do not invent',
  'work that the titles do not imply. Respond with only the summary prose — no',
  'preamble, headings, bullet points, or meta-commentary.',
].join(' ');

export interface FocusResult {
  summary: string | null;
  error: string | null; // short reason when summary is null (null when no key)
}

interface ModelEntry {
  name?: string;
  supportedGenerationMethods?: string[];
}

// Cached across invocations in the same serverless instance (set only on success).
let cachedModel: string | null = null;

function snippet(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * Pick a Gemini model the key can actually use for generateContent. Honors
 * GEMINI_MODEL, then a cached working model, else discovers one — preferring a
 * stable "flash" model. Returns { model, error }.
 */
async function resolveModel(
  apiKey: string,
  signal: AbortSignal,
): Promise<{ model: string | null; error: string | null }> {
  if (process.env.GEMINI_MODEL) return { model: process.env.GEMINI_MODEL, error: null };
  if (cachedModel) return { model: cachedModel, error: null };

  const res = await fetch(`${API_BASE}/models`, {
    headers: { 'x-goog-api-key': apiKey },
    signal,
  });
  if (!res.ok) {
    return {
      model: null,
      error: `Couldn't list Gemini models (HTTP ${res.status}: ${snippet(
        await res.text().catch(() => ''),
      )}). Check the API key.`,
    };
  }

  const models = (((await res.json()) as { models?: ModelEntry[] }).models ?? []).filter(
    (m) => (m.supportedGenerationMethods ?? []).includes('generateContent'),
  );
  const bare = (m: ModelEntry) => (m.name ?? '').replace(/^models\//, '');
  const usable = models.map(bare).filter(Boolean);

  const flashStable = usable
    .filter((n) => /flash/i.test(n) && !/(exp|preview|thinking)/i.test(n))
    .sort()
    .reverse(); // newer version strings sort last → reverse to prefer newest
  const anyFlash = usable.filter((n) => /flash/i.test(n));
  const picked = flashStable[0] ?? anyFlash[0] ?? usable[0] ?? null;

  if (!picked) {
    return { model: null, error: 'No Gemini model available to this key supports text generation.' };
  }
  return { model: picked, error: null };
}

export async function generateFocusSummary(
  sprintName: string,
  taskTitles: string[],
): Promise<FocusResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { summary: null, error: null };

  const titles = taskTitles
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TITLES);
  if (titles.length === 0) return { summary: null, error: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { model, error } = await resolveModel(apiKey, controller.signal);
    if (!model) return { summary: null, error };

    const response = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Sprint: ${sprintName}\n\nTask titles:\n- ${titles.join('\n- ')}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = snippet(await response.text().catch(() => ''));
      console.error(`[sprint-focus-summary] Gemini HTTP ${response.status}: ${detail}`);
      return { summary: null, error: `Gemini "${model}" HTTP ${response.status}: ${detail}` };
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!text) return { summary: null, error: `Gemini "${model}" returned no text.` };

    cachedModel = model; // remember the working model
    return { summary: text, error: null };
  } catch (error) {
    const msg = controller.signal.aborted ? 'Gemini request timed out.' : String(error);
    console.error('[sprint-focus-summary] generation failed:', error);
    return { summary: null, error: snippet(msg) };
  } finally {
    clearTimeout(timer);
  }
}
