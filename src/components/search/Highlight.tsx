import { Fragment } from 'react';
import { highlight } from '@/lib/search-core';

/**
 * Renders `text` with the query's literal matches wrapped in <mark>.
 * Fuzzy-only hits render plain — a highlight scattered across
 * non-adjacent characters is harder to read than no highlight.
 */
export function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;

  const segments = highlight(text, query);
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark className="astra-mark" key={index}>
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
