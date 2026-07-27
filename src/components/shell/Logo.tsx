/**
 * ASTRA mark — a minimal molecule: one central node bonded to three
 * satellites. Drawn with currentColor so it inherits from its container
 * and needs no dark-mode variant.
 */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 12L5 7M12 12l7-5M12 12v7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <circle cx="5" cy="7" r="2.1" fill="currentColor" opacity="0.75" />
      <circle cx="19" cy="7" r="2.1" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="19.5" r="2.1" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

/** Logo lockup for the sidebar brand slot. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--vbds-radius-sm)',
        background: 'linear-gradient(140deg, var(--vbds-primary), var(--vbds-accent))',
        color: '#fff',
        flexShrink: 0,
        boxShadow: 'var(--vbds-shadow-card)',
      }}
    >
      <Logo size={size * 0.62} />
    </span>
  );
}
