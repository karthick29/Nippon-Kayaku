'use client';

import { Monitor, Moon, Rows3, Rows4, Sun } from 'lucide-react';
import { Card, CardHeader, Divider, SegmentedControl, Switch } from '@/components/vbds';
import { useTheme } from '@/components/shell/ThemeProvider';
import { useRecentSearches } from '@/components/shell/useRecentSearches';
import { useState } from 'react';
import { toast } from 'sonner';

export function PreferencesPanel() {
  const { theme, setTheme, density, setDensity } = useTheme();
  const { recents, clearRecents } = useRecentSearches();
  const [tooltips, setTooltips] = useState(true);
  const [confirmDestructive, setConfirmDestructive] = useState(true);

  return (
    <Card padding="md">
      <CardHeader title="Preferences" subtitle="How ASTRA looks and behaves for you on this device." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vbds-space-20)' }}>
        <PreferenceRow
          label="Appearance"
          hint="Dark mode is a selected palette, not an inverted one — chart colours are re-stepped for the dark surface."
        >
          <SegmentedControl
            ariaLabel="Theme"
            value={theme}
            onValueChange={(v) => setTheme(v as 'light' | 'dark')}
            items={[
              { value: 'light', label: 'Light', icon: <Sun size={13} /> },
              { value: 'dark', label: 'Dark', icon: <Moon size={13} /> },
            ]}
          />
        </PreferenceRow>

        <Divider />

        <PreferenceRow
          label="Density"
          hint="Compact is the desktop default — 38px controls and tighter radii, about 30% more table rows per screen. Comfortable restores the design system's tablet scale."
        >
          <SegmentedControl
            ariaLabel="Density"
            value={density}
            onValueChange={(v) => setDensity(v as 'compact' | 'comfortable')}
            items={[
              { value: 'compact', label: 'Compact', icon: <Rows4 size={13} /> },
              { value: 'comfortable', label: 'Comfortable', icon: <Rows3 size={13} /> },
            ]}
          />
        </PreferenceRow>

        <Divider />

        <PreferenceRow label="Tooltips" hint="Show helper tooltips on icon buttons and truncated table cells.">
          <Switch checked={tooltips} onCheckedChange={setTooltips} label="Enabled" />
        </PreferenceRow>

        <Divider />

        <PreferenceRow
          label="Confirm destructive actions"
          hint="Always ask before deleting a product or company. Strongly recommended."
        >
          <Switch
            checked={confirmDestructive}
            onCheckedChange={(next) => {
              setConfirmDestructive(next);
              if (!next) toast.warning('Delete confirmations disabled for this session.');
            }}
            label="Enabled"
          />
        </PreferenceRow>

        <Divider />

        <PreferenceRow
          label="Recent searches"
          hint={`${recents.length} stored in this browser. Recent searches never leave your device.`}
        >
          <button
            type="button"
            className="vbds-button vbds-button--outlined vbds-button--sm"
            onClick={() => {
              clearRecents();
              toast.success('Recent searches cleared');
            }}
            disabled={recents.length === 0}
          >
            Clear history
          </button>
        </PreferenceRow>

        <Divider />

        <PreferenceRow label="Keyboard" hint="Every primary action is reachable without a mouse.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <Shortcut keys={['⌘', 'K']} action="Open command palette" />
            <Shortcut keys={['/']} action="Focus search" />
            <Shortcut keys={['Esc']} action="Close overlay" />
            <Shortcut keys={['↑', '↓']} action="Move through results" />
          </div>
        </PreferenceRow>
      </div>

      <div style={{ marginTop: 'var(--vbds-space-20)' }}>
        <Monitor
          size={13}
          style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--vbds-text-tertiary)' }}
          aria-hidden="true"
        />
        <span style={{ fontSize: 'var(--vbds-caption-size)', color: 'var(--vbds-text-tertiary)' }}>
          Preferences are stored in this browser only and apply immediately.
        </span>
      </div>
    </Card>
  );
}

function PreferenceRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="astra-pref-row">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 'var(--vbds-body-size)', fontWeight: 600 }}>{label}</div>
        <p
          style={{
            fontSize: 'var(--vbds-caption-size)',
            color: 'var(--vbds-text-secondary)',
            marginTop: 2,
            maxWidth: 560,
            lineHeight: 'var(--vbds-caption-line)',
          }}
        >
          {hint}
        </p>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Shortcut({ keys, action }: { keys: string[]; action: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--vbds-caption-size)' }}>
      <span style={{ color: 'var(--vbds-text-secondary)' }}>{action}</span>
      {keys.map((key) => (
        <span className="astra-kbd" key={key}>
          {key}
        </span>
      ))}
    </span>
  );
}
