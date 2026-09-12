import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { z } from 'zod';
import type { Locale } from '@flowdesk/types';
import { en } from './locales/en';
import { ar } from './locales/ar';
import { zodErrorMap } from './zod-error-map';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ar'];
export const RTL_LOCALES: Locale[] = ['ar'];

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale);
}

/** Keep <html dir/lang> in sync with the active language. */
export function applyDocumentDirection(locale: string): void {
  const dir = isRtl(locale) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'flowdesk.locale',
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', applyDocumentDirection);
applyDocumentDirection(i18n.resolvedLanguage ?? 'en');

// Localize Zod validation messages (form errors) via i18next.
z.setErrorMap(zodErrorMap);

export default i18n;
