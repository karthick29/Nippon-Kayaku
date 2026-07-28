import Link from 'next/link';
import { LogoMark } from '@/components/shell/Logo';

export default function RootNotFound() {
  return (
    <div className="astra-auth">
      <div className="astra-auth__card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <LogoMark size={44} />
        </div>
        <h1 style={{ fontSize: 'var(--vbds-headline-size)', fontWeight: 700, marginBottom: 8 }}>
          Page not found
        </h1>
        <p style={{ color: 'var(--vbds-text-secondary)', marginBottom: 24 }}>
          That address doesn&apos;t match anything in nipponkayaku.
        </p>
        <Link href="/dashboard" className="vbds-button vbds-button--primary vbds-button--full">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
