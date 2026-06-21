/**
 * Generate a short "what did this sprint focus on" summary from task titles,
 * using the Google Gemini API (free tier via Google AI Studio). Recurring/daily
 * tasks are excluded by the caller — only real deliverables are passed in.
 *
 * Graceful by design: returns null (never throws) when GEMINI_API_KEY is not
 * configured, when there are no titles, or on any API error — so the rest of the
 * sprint summary still works and the operator can type a focus note manually.
 *
 * Uses the REST endpoint directly (no SDK dependency). Auth is the AI Studio API
 * key via the x-goog-api-key header.
 */

const DEFAULT_MODEL = 'gemini-2.0-flash';
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

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function generateFocusSummary(
  sprintName: string,
  taskTitles: string[],
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const titles = taskTitles
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TITLES);
  if (titles.length === 0) return null;

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Fail fast rather than hanging the summary request if the API is slow.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
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
      const detail = await response.text().catch(() => '');
      console.error(
        `[sprint-focus-summary] Gemini HTTP ${response.status}: ${detail.slice(0, 300)}`,
      );
      return null;
    }

    const data = (await response.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    return text || null;
  } catch (error) {
    console.error('[sprint-focus-summary] generation failed:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
