import Anthropic from '@anthropic-ai/sdk';

/**
 * Generate a short "what did this sprint focus on" summary from task titles,
 * using Claude. Recurring/daily tasks are excluded by the caller — only real
 * deliverables are passed in.
 *
 * Graceful by design: returns null (never throws) when ANTHROPIC_API_KEY is not
 * configured, when there are no titles, or on any API error — so the rest of the
 * sprint summary still works and the operator can type a focus note manually.
 */

const MODEL = 'claude-opus-4-8';
const MAX_TITLES = 400; // keep the prompt bounded for very large sprints

const SYSTEM_PROMPT = [
  "You summarize a software team's sprint.",
  'Given the titles of the tasks worked on during a sprint (recurring/daily tasks',
  'already excluded), write a concise 2–4 sentence summary of what the team focused',
  'on, grouped by theme where natural (e.g. development work, improvements, bug',
  'fixes, or a specific product/client). Do not list every task, and do not invent',
  'work that the titles do not imply. Respond with only the summary prose — no',
  'preamble, headings, bullet points, or meta-commentary.',
].join(' ');

export async function generateFocusSummary(
  sprintName: string,
  taskTitles: string[],
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const titles = taskTitles
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_TITLES);
  if (titles.length === 0) return null;

  // Fail fast rather than hanging the summary request if the API is slow.
  const client = new Anthropic({ timeout: 30000, maxRetries: 1 });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Sprint: ${sprintName}\n\nTask titles:\n- ${titles.join('\n- ')}`,
        },
      ],
    });

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    return text || null;
  } catch (error) {
    console.error('[sprint-focus-summary] generation failed:', error);
    return null;
  }
}
