import type { TFunction } from 'i18next';
import i18n from '@/lib/i18n';
import { ApiError } from './client';

/**
 * Human, localized text for any thrown error — use this for every `toast.error`.
 *
 * English keeps the server's specific message (it is authored in English).
 * Other locales map the error **code** to a translated sentence, falling back to
 * the server message and then a generic line, so Arabic users never see a raw
 * English string.
 */
export function errorText(err: unknown, t: TFunction): string {
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const isEnglish = lang.startsWith('en');

  if (err instanceof ApiError) {
    if (isEnglish) return err.message || t('errors.generic');
    const byCode = t(`errors.byCode.${err.code}`, { defaultValue: '' });
    return byCode || err.message || t('errors.generic');
  }
  if (err instanceof Error && err.name === 'AbortError') return t('errors.network');
  if (err instanceof TypeError) return t('errors.network');
  if (err instanceof Error) return isEnglish ? err.message || t('errors.generic') : t('errors.generic');
  return t('errors.generic');
}
