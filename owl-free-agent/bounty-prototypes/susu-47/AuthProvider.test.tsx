/** @vitest-environment jsdom
 * Candidate for SUSU-LABS/susu-web#47, UNFUNDED/UNASSIGNED.
 * Based on AuthProvider.tsx read 2026-10-14. Tests must be run against upstream dependencies.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: {
    getSession: mocks.getSession,
    onAuthStateChange: mocks.onAuthStateChange,
  } }),
}));
vi.mock('@/lib/auth/actions', () => ({ signOut: mocks.signOut }));

import { AuthProvider } from '@/components/AuthProvider';
import { useAuth } from '@/lib/auth/context';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
let onAuth: (_event: string, session: Session | null) => void;
const unsubscribe = vi.fn();

function StateProbe() {
  const auth = useAuth();
  return <output data-status={auth.status} data-user={auth.user?.id ?? ''}>
    <button onClick={() => void auth.signOut()}>sign out</button>
  </output>;
}
function session(id: string) {
  return { user: { id } } as Session;
}
async function mount() {
  await act(async () => root.render(<AuthProvider><StateProbe /></AuthProvider>));
}
const status = () => container.querySelector('output')?.dataset.status;
const user = () => container.querySelector('output')?.dataset.user;

describe('AuthProvider session observation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mocks.onAuthStateChange.mockImplementation((handler) => {
      onAuth = handler;
      return { data: { subscription: { unsubscribe } } };
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signOut.mockResolvedValue({ ok: true });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('reads persisted session before settling authenticated', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session('persisted') } });
    await mount();
    expect(status()).toBe('authenticated');
    expect(user()).toBe('persisted');
  });
  it('applies the auth-change callback', async () => {
    await mount();
    await act(async () => onAuth('SIGNED_IN', session('event-user')));
    expect(status()).toBe('authenticated');
    expect(user()).toBe('event-user');
  });
  it('does not regress from newer callback to late initial read', async () => {
    let complete!: (data: unknown) => void;
    mocks.getSession.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    await mount();
    await act(async () => onAuth('SIGNED_IN', session('newer')));
    await act(async () => complete({ data: { session: null } }));
    // This assertion may expose an upstream race: do not relax it to force green.
    expect(user()).toBe('newer');
  });
  it('unsubscribes on unmount', async () => {
    await mount();
    await act(async () => root.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
  it('settles to anonymous when initial session read rejects', async () => {
    mocks.getSession.mockRejectedValue(new Error('offline'));
    await mount();
    expect(status()).toBe('anonymous');
  });
  it('drops local state when signOut action returns failure', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session('before') } });
    mocks.signOut.mockResolvedValue({ ok: false });
    await mount();
    await act(async () => container.querySelector('button')?.click());
    expect(status()).toBe('anonymous');
    expect(user()).toBe('');
  });
});
