import { create } from 'zustand';
import type { AuthUser, WorkspaceMembershipView } from '@flowdesk/types';
import { api, ApiError, configureApiClient } from '@/lib/api/client';

interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: AuthUser | null;
  memberships: WorkspaceMembershipView[];
  accessToken: string | null;
  /** epoch ms when the access token expires */
  expiresAt: number | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  setUser: (user: AuthUser) => void;
  reloadMemberships: () => Promise<void>;
}

function applySession(token: string, expiresIn: number): void {
  useAuth.setState({ accessToken: token, expiresAt: Date.now() + expiresIn * 1000 });
}

// Module-level guards so React StrictMode's double-invoke and concurrent callers
// never fire two refreshes against the same (rotating) cookie.
let bootstrapPromise: Promise<void> | null = null;
let refreshPromise: Promise<boolean> | null = null;

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  memberships: [],
  accessToken: null,
  expiresAt: null,

  bootstrap: () => {
    bootstrapPromise ??= (async () => {
      const ok = await get().refresh();
      if (!ok) {
        set({ status: 'anonymous', user: null, memberships: [] });
        return;
      }
      try {
        const me = await api.get<{ user: AuthUser; memberships: WorkspaceMembershipView[] }>('/auth/me');
        set({ status: 'authenticated', user: me.user, memberships: me.memberships });
      } catch {
        set({ status: 'anonymous', user: null, memberships: [] });
      }
    })().finally(() => {
      bootstrapPromise = null;
    });
    return bootstrapPromise;
  },

  login: async (email, password) => {
    const res = await api.post<{
      user: AuthUser;
      tokens: { accessToken: string; expiresIn: number };
      memberships: WorkspaceMembershipView[];
    }>('/auth/login', { email, password }, { anonymous: true });
    applySession(res.tokens.accessToken, res.tokens.expiresIn);
    set({ status: 'authenticated', user: res.user, memberships: res.memberships });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore network errors on logout */
    }
    set({ status: 'anonymous', user: null, memberships: [], accessToken: null, expiresAt: null });
  },

  refresh: () => {
    refreshPromise ??= (async () => {
      try {
        const res = await api.post<{ accessToken: string; expiresIn: number }>('/auth/refresh', undefined, {
          anonymous: true,
        });
        applySession(res.accessToken, res.expiresIn);
        // NOTE: do not flip `status` here. A valid access token alone is not
        // enough to route — `bootstrap()` promotes to `authenticated` only after
        // `/auth/me` (user + memberships) has loaded, so guards never act on an
        // interim empty-memberships state.
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.isAuth) {
          // The refresh cookie itself is invalid/expired — this is a real session end,
          // not a transient blip. Flip to anonymous too, instead of leaving the app
          // "authenticated" with no way to ever get a token again (every subsequent API
          // call and the realtime connection would just 401 in a loop until the user
          // manually reloads the page).
          set({ status: 'anonymous', user: null, memberships: [], accessToken: null, expiresAt: null });
        }
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  },

  setUser: (user) => set({ user }),

  reloadMemberships: async () => {
    const me = await api.get<{ user: AuthUser; memberships: WorkspaceMembershipView[] }>('/auth/me');
    set({ user: me.user, memberships: me.memberships });
  },
}));

// Wire the API client to the store: it reads the current token and knows how to
// refresh on a 401.
configureApiClient({
  getToken: () => useAuth.getState().accessToken,
  onRefresh: () => useAuth.getState().refresh(),
});
