'use client';

import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import { useActionState, useState } from 'react';
import type { Role } from '@/lib/types';
import { Badge, Button, Divider, TextField } from '@/components/vbds';
import { LogoMark } from '@/components/shell/Logo';
import { ROLE_LABELS } from '@/server/rbac';
import { signInAction, type SignInState } from '@/server/actions/auth';

interface DemoAccount {
  name: string;
  email: string;
  role: Role;
  title?: string;
}

export function SignInForm({ accounts }: { accounts: DemoAccount[] }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, {});
  const [email, setEmail] = useState(accounts[0]?.email ?? '');
  const [password, setPassword] = useState('astra-demo');

  return (
    <div className="astra-auth">
      <div className="astra-auth__card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <LogoMark size={40} />
          <div>
            <div style={{ fontSize: 'var(--vbds-headline-size)', fontWeight: 700, letterSpacing: '0.04em' }}>
              nipponkayaku
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--vbds-text-tertiary)',
              }}
            >
              Nippon Kayaku · Chemical Intelligence
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 'var(--vbds-title-size)', fontWeight: 600, marginBottom: 4 }}>
          Sign in to your workspace
        </h1>
        <p
          style={{
            fontSize: 'var(--vbds-caption-size)',
            color: 'var(--vbds-text-secondary)',
            marginBottom: 'var(--vbds-space-24)',
          }}
        >
          Use your Nippon Kayaku account to continue.
        </p>

        {state.error && (
          <div className="astra-auth__error" role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            {state.error}
          </div>
        )}

        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vbds-space-16)' }}>
          <TextField
            name="email"
            type="email"
            label="Email address"
            placeholder="name@nipponkayaku.example.com"
            leadingIcon={<Mail size={15} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!state.fields?.email}
            supportingText={state.fields?.email}
            autoComplete="email"
            required
            fullWidth
          />

          <TextField
            name="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            leadingIcon={<Lock size={15} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!state.fields?.password}
            supportingText={state.fields?.password}
            autoComplete="current-password"
            required
            fullWidth
          />

          <Button type="submit" fullWidth loading={pending} trailingIcon={<ArrowRight size={15} />}>
            Sign in
          </Button>
        </form>

        <div style={{ margin: 'var(--vbds-space-24) 0 var(--vbds-space-16)' }}>
          <Divider label="Demo accounts" />
        </div>

        <p
          style={{
            fontSize: 'var(--vbds-caption-size)',
            color: 'var(--vbds-text-tertiary)',
            marginBottom: 'var(--vbds-space-12)',
          }}
        >
          Pick a role to explore the seeded workspace. Any password of four or more characters works.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {accounts.slice(0, 4).map((account) => (
            <button
              key={account.email}
              type="button"
              className="astra-auth__account"
              onClick={() => {
                setEmail(account.email);
                setPassword('astra-demo');
              }}
            >
              <span style={{ minWidth: 0, textAlign: 'left' }}>
                <span className="astra-auth__account-name">{account.name}</span>
                <span className="astra-auth__account-title">{account.title}</span>
              </span>
              <Badge tone="primary" size="sm">
                {ROLE_LABELS[account.role]}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
