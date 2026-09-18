import type { TFunction } from 'i18next';
import i18n from '@/lib/i18n';
import { ApiError } from './client';

/**
 * Human text for any thrown error — use this for every `toast.error`.
 *
 * Always shows the server's own message when there is one: it's specific to
 * what actually went wrong (e.g. "An account with that email already
 * exists."), whereas the per-code translations are generic and can be
 * actively misleading (e.g. `conflict` is also used for optimistic-locking
 * clashes, so its Arabic text talks about refreshing the page — wrong for a
 * duplicate-email error). Falls back to a translated generic line only when
 * the server didn't send a message at all.
 */
export function errorText(err: unknown, t: TFunction): string {
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const isEnglish = lang.startsWith('en');

  if (err instanceof ApiError) {
    if (err.message) return err.message;
    if (!isEnglish) {
      const byCode = t(`errors.byCode.${err.code}`, { defaultValue: '' });
      if (byCode) return byCode;
    }
    return t('errors.generic');
  }
  if (err instanceof Error && err.name === 'AbortError') return t('errors.network');
  if (err instanceof TypeError) return t('errors.network');
  if (err instanceof Error) return isEnglish ? err.message || t('errors.generic') : t('errors.generic');
  return t('errors.generic');
}
