export type TextResult = {
  text: string;
  riskFlags: string[];
};

const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/ignore\s+(all\s+)?previous\s+instructions/i, 'prompt-injection:ignore-previous-instructions'],
  [/system\s+prompt/i, 'prompt-injection:system-prompt'],
  [/reveal\s+(your\s+)?(prompt|instructions|secrets?)/i, 'prompt-injection:reveal'],
  [/exfiltrat(e|ion)/i, 'prompt-injection:exfiltrate'],
  [/developer\s+message/i, 'prompt-injection:developer-message'],
  [/tool\s+call/i, 'prompt-injection:tool-call'],
];

const HIDDEN_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/display\s*:\s*none/i, 'hidden-text:display-none'],
  [/visibility\s*:\s*hidden/i, 'hidden-text:visibility-hidden'],
  [/font-size\s*:\s*0(?:px|em|rem|%)?/i, 'hidden-text:font-size-zero'],
  [/opacity\s*:\s*0(?:\.0+)?/i, 'hidden-text:opacity-zero'],
  [/aria-hidden\s*=\s*["']?true/i, 'hidden-text:aria-hidden'],
];

export function uniqueFlags(flags: string[]): string[] {
  return [...new Set(flags)];
}

export function detectPromptInjection(text: string): string[] {
  const flags: string[] = [];
  for (const [pattern, flag] of INJECTION_PATTERNS) {
    if (pattern.test(text)) flags.push(flag);
  }
  return uniqueFlags(flags);
}

export function detectHiddenText(html: string): string[] {
  const flags: string[] = [];
  for (const [pattern, flag] of HIDDEN_TEXT_PATTERNS) {
    if (pattern.test(html)) flags.push(flag);
  }
  return uniqueFlags(flags);
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function sanitizeHtml(html: string): TextResult {
  const riskFlags = detectHiddenText(html);
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  text = normalizeWhitespace(decodeHtmlEntities(text));
  riskFlags.push(...detectPromptInjection(text));
  return { text, riskFlags: uniqueFlags(riskFlags) };
}

export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (!Number.isFinite(maxChars) || maxChars < 0) throw new Error('Invalid maxChars');
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n[TRUNCATED: exceeded ${maxChars} chars]`,
    truncated: true,
  };
}

export function wrapUntrusted(text: string): string {
  return `[UNTRUSTED WEB CONTENT START]\n${text}\n[UNTRUSTED WEB CONTENT END]`;
}
