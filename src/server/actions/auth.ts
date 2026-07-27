'use server';

import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/server/auth';
import { signInSchema } from '@/lib/validation';

/* ════════════════════════════════════════════════════════════════════
   Auth server actions.

   Server Actions rather than fetch calls so the sign-in form works
   without JavaScript and Next.js applies its built-in Action origin
   check — that check is ASTRA's CSRF protection for mutations.
   ════════════════════════════════════════════════════════════════════ */

export interface SignInState {
  error?: string;
  fields?: Record<string, string>;
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (!fields[key]) fields[key] = issue.message;
    }
    return { error: 'Check the highlighted fields.', fields };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  redirect('/dashboard');
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/sign-in');
}
