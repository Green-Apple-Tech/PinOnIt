/** ~10k words — cost control before Anthropic summarize. */
export const PLAIN_LANGUAGE_MAX_WORDS = 10_000;

export const PLAIN_LANGUAGE_TRUNCATE_NOTE =
  'This summary covers the first ~10,000 words of a longer template.';

export const PLAIN_LANGUAGE_DISCLAIMER =
  "This is a summary to help you understand. The full agreement below is what you're signing.";

/** Opt-in checkbox — default unchecked. Reveals the AI summary. */
export const PLAIN_LANGUAGE_OPT_IN_LABEL =
  'Check for a fast AI summary. Still read the full text — summaries miss details.';


export function truncateForPlainLanguageSummary(text: string): {
  text: string;
  truncated: boolean;
  wordCount: number;
} {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= PLAIN_LANGUAGE_MAX_WORDS) {
    return { text: text.trim(), truncated: false, wordCount: words.length };
  }
  return {
    text: words.slice(0, PLAIN_LANGUAGE_MAX_WORDS).join(' '),
    truncated: true,
    wordCount: words.length,
  };
}

/** Normalize AI / editor bullets to a stored newline-separated string. */
export function normalizePlainLanguageBullets(input: string | string[] | null | undefined): string {
  if (input == null) return '';
  const lines = Array.isArray(input)
    ? input
    : input.split(/\n+/);
  return lines
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
    .join('\n');
}

export function plainLanguageBulletsFromStored(stored: string | null | undefined): string[] {
  if (!stored?.trim()) return [];
  return stored
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean);
}
