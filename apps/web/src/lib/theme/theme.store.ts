import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemePreference } from '@flowdesk/types';

interface ThemeState {
  preference: ThemePreference;
  /** the actually-applied theme after resolving `system` */
  resolved: 'light' | 'dark';
  setPreference: (pref: ThemePreference) => void;
  syncResolved: () => void;
}

const mql = window.matchMedia('(prefers-color-scheme: dark)');

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return mql.matches ? 'dark' : 'light';
  return pref;
}

function paint(resolved: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      resolved: resolve('system'),
      setPreference: (preference) => {
        const resolved = resolve(preference);
        paint(resolved);
        set({ preference, resolved });
      },
      syncResolved: () => {
        const resolved = resolve(get().preference);
        paint(resolved);
        set({ resolved });
      },
    }),
    {
      name: 'flowdesk.theme',
      partialize: (s) => ({ preference: s.preference }),
      onRehydrateStorage: () => (state) => {
        state?.syncResolved();
      },
    },
  ),
);

// React to OS theme changes while preference is `system`.
mql.addEventListener('change', () => {
  if (useTheme.getState().preference === 'system') useTheme.getState().syncResolved();
});

// Apply once at module load (covers first paint before React mounts).
paint(useTheme.getState().resolved);
