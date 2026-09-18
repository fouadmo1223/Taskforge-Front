import type { TFunction } from 'i18next';
import i18n from '@/lib/i18n';
import { ApiError } from './client';

/**
 * Error codes with their own purpose-written translation in both locales
 * (not shared with unrelated errors) — safe to prefer over the raw server
 * message in every language. Every other code is a broad bucket reused
 * across unrelated conditions (e.g. `conflict` covers both "email already
 * exists" and optimistic-locking clashes), so a single translation for it
 * can't be accurate for all of them — those fall back to the server's own
 * (English) message instead, which is always at least accurate.
 */
const SPECIFIC_ERROR_CODES = new Set(['invite_invalid', 'invite_email_mismatch']);

/** Human text for any thrown error — use this for every `toast.error`. */
export function errorText(err: unknown, t: TFunction): string {
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const isEnglish = lang.startsWith('en');

  if (err instanceof ApiError) {
    if (SPECIFIC_ERROR_CODES.has(err.code)) {
      const byCode = t(`errors.byCode.${err.code}`, { defaultValue: '' });
      if (byCode) return byCode;
    }
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
