import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '@flowdesk/types';
import { useTheme } from '@/lib/theme/theme.store';
import { cn } from '@/lib/cn';

const THEME_ICON: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function LanguageThemeControls({ compact }: { compact?: boolean }): React.ReactElement {
  const { i18n } = useTranslation();
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);
  const order: ThemePreference[] = ['light', 'dark', 'system'];
  const Icon = THEME_ICON[preference];

  const nextTheme = (): void => {
    const idx = order.indexOf(preference);
    setPreference(order[(idx + 1) % order.length]!);
  };
  const toggleLang = (): void => {
    void i18n.changeLanguage(i18n.resolvedLanguage === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className={cn('flex items-center gap-1', compact && 'gap-0.5')}>
      <button
        onClick={toggleLang}
        className="rounded-lg px-2 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-sunken hover:text-text"
        aria-label="Toggle language"
      >
        {i18n.resolvedLanguage === 'ar' ? 'EN' : 'ع'}
      </button>
      <button
        onClick={nextTheme}
        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text"
        aria-label="Toggle theme"
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}
