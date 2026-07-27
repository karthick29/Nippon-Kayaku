/* ════════════════════════════════════════════════════════════════════
   Search scoring primitives.

   Deliberately dependency-free and pure so the same ranking runs on the
   server (API routes, RSC) and in the browser (command palette, instant
   filtering) with identical results. When the Prisma adapter is enabled,
   `scoreMatch` is what a Postgres `pg_trgm` similarity index would
   replace — see docs/ARCHITECTURE.md.
   ════════════════════════════════════════════════════════════════════ */

export const SCORE = {
  EXACT: 1000,
  PREFIX: 700,
  WORD_PREFIX: 500,
  SUBSTRING: 300,
  FUZZY: 120,
  NONE: 0,
} as const;

/** Lowercase, strip accents and collapse whitespace. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** CAS numbers are compared without separators so "501531" finds "501-53-1". */
export function normalizeCas(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/**
 * Subsequence test with a gap penalty — "bnzcl" matches "benzyl chloroformate".
 * Returns a 0–1 quality factor, or null when the needle is not a subsequence.
 */
function subsequenceQuality(needle: string, haystack: string): number | null {
  if (!needle) return null;
  let hi = 0;
  let gaps = 0;
  let firstIndex = -1;

  for (let ni = 0; ni < needle.length; ni += 1) {
    const ch = needle[ni]!;
    const found = haystack.indexOf(ch, hi);
    if (found === -1) return null;
    if (firstIndex === -1) firstIndex = found;
    if (ni > 0) gaps += found - hi;
    hi = found + 1;
  }

  const span = hi - firstIndex;
  const density = needle.length / Math.max(span, 1);
  const headBonus = firstIndex === 0 ? 0.2 : 0;
  return Math.max(0, Math.min(1, density * 0.8 + headBonus - gaps / (haystack.length * 4)));
}

/**
 * Scores a single field against a query. Higher is better; 0 means no match.
 * Longer fields are lightly penalised so short exact-ish fields win ties.
 */
export function scoreMatch(query: string, field: string): number {
  if (!query || !field) return SCORE.NONE;
  const q = normalize(query);
  const f = normalize(field);
  if (!q) return SCORE.NONE;

  const lengthPenalty = Math.min(60, f.length / 4);

  if (f === q) return SCORE.EXACT;
  if (f.startsWith(q)) return SCORE.PREFIX - lengthPenalty;

  // Word-boundary prefix, e.g. "chloro" in "Benzyl chloroformate".
  const words = f.split(/[\s,()/\-]+/);
  if (words.some((w) => w.startsWith(q))) return SCORE.WORD_PREFIX - lengthPenalty;

  if (f.includes(q)) return SCORE.SUBSTRING - lengthPenalty;

  // Fuzzy only for queries long enough to be meaningful.
  if (q.length >= 3) {
    const quality = subsequenceQuality(q.replace(/\s/g, ''), f.replace(/\s/g, ''));
    if (quality !== null && quality > 0.32) return SCORE.FUZZY * quality;
  }

  return SCORE.NONE;
}

/** Scores a CAS field, tolerating missing or differently-placed hyphens. */
export function scoreCas(query: string, cas: string): number {
  const qDigits = normalizeCas(query);
  if (qDigits.length < 3) return SCORE.NONE;
  const casDigits = normalizeCas(cas);
  if (casDigits === qDigits) return SCORE.EXACT;
  if (casDigits.startsWith(qDigits)) return SCORE.PREFIX;
  if (casDigits.includes(qDigits)) return SCORE.SUBSTRING;
  return SCORE.NONE;
}

export interface FieldSpec {
  name: string;
  value: string | undefined;
  /** Multiplies the field score — name fields outrank description fields. */
  weight: number;
  /** Use CAS-aware comparison. */
  cas?: boolean;
}

export interface BestMatch {
  score: number;
  field: string;
  value: string;
}

/** Scores a record across many fields and reports which field won. */
export function bestMatch(query: string, fields: FieldSpec[]): BestMatch {
  let best: BestMatch = { score: 0, field: '', value: '' };

  for (const f of fields) {
    if (!f.value) continue;
    const raw = f.cas ? scoreCas(query, f.value) : scoreMatch(query, f.value);
    const score = raw * f.weight;
    if (score > best.score) best = { score, field: f.name, value: f.value };
  }

  return best;
}

/* ── Highlighting ───────────────────────────────────────────────── */

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Splits text into matched / unmatched segments for <mark> rendering.
 * Falls back to a single unmatched segment when the query is not a
 * literal substring (fuzzy hits are not highlighted — a scattered
 * highlight is harder to read than none).
 */
export function highlight(text: string, query: string): HighlightSegment[] {
  const q = normalize(query);
  if (!q || q.length < 1) return [{ text, match: false }];

  const haystack = normalize(text);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  // Highlight each query token independently so "benzyl chloro" marks both.
  const tokens = Array.from(new Set(q.split(' ').filter((t) => t.length >= 2))).sort(
    (a, b) => b.length - a.length,
  );
  if (tokens.length === 0) return [{ text, match: false }];

  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const idx = haystack.indexOf(token, from);
      if (idx === -1) break;
      ranges.push([idx, idx + token.length]);
      from = idx + token.length;
    }
  }
  if (ranges.length === 0) return [{ text, match: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });

  return segments;
}
