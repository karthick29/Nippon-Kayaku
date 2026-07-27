import { FileQuestion } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/vbds';

export default function AppNotFound() {
  return (
    <div className="astra-page">
      <Card padding="lg">
        <EmptyState
          icon={<FileQuestion size={22} />}
          title="We couldn't find that"
          description="The product, company or page you asked for doesn't exist — or it was deleted. Search the catalogue or head back to the dashboard."
          action={
            <>
              <Button variant="secondary" href="/search">
                Search chemicals
              </Button>
              <Button variant="ghost" href="/dashboard">
                Dashboard
              </Button>
            </>
          }
        />
      </Card>
    </div>
  );
}
