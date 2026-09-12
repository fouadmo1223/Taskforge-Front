import 'react-i18next';
import type { TranslationSchema } from './locales/en';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: TranslationSchema };
  }
}
