'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Button, Card, EmptyState } from '@/components/vbds';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this is where an error reporter would receive it.
    console.error('[astra]', error);
  }, [error]);

  return (
    <div className="astra-page">
      <Card padding="lg">
        <EmptyState
          tone="danger"
          icon={<TriangleAlert size={22} />}
          title="Something went wrong"
          description="This section failed to load. Retrying usually fixes it — if it doesn't, the reference below will help support trace it."
          action={
            <>
              <Button icon={<RotateCcw size={14} />} onClick={reset}>
                Try again
              </Button>
              <Button variant="ghost" href="/dashboard">
                Back to dashboard
              </Button>
            </>
          }
        />
        {error.digest && (
          <p
            style={{
              textAlign: 'center',
              fontSize: 'var(--vbds-caption-size)',
              color: 'var(--vbds-text-tertiary)',
              fontFamily: 'var(--vbds-font-mono)',
            }}
          >
            Reference {error.digest}
          </p>
        )}
      </Card>
    </div>
  );
}
