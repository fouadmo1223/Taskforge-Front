/**
 * Carries a pending workspace-invite token through the register -> verify
 * email -> log in detour, where React Router's in-memory redirect state
 * (`location.state.from`) doesn't survive — email verification happens via a
 * link clicked outside the app's own navigation, often in a new tab.
 */
const STORAGE_KEY = 'pendingInviteToken';

export function savePendingInviteToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable (private mode, disabled site data) — the
    // invite still works, it just requires re-clicking the email afterward.
  }
}

/** Reads and clears the pending token, if any — call once, right after login succeeds. */
export function consumePendingInviteToken(): string | null {
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    if (token) localStorage.removeItem(STORAGE_KEY);
    return token;
  } catch {
    return null;
  }
}
