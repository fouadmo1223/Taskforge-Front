import i18n from 'i18next';
import { z } from 'zod';

/**
 * Localizes every Zod validation message through i18next so form errors follow
 * the active language. Registered once at startup and re-applied on language
 * change (see ./index.ts).
 */
export const zodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  const tr = i18n.t.bind(i18n);

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: tr('validation.required') };
      }
      return { message: tr('validation.invalidType') };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: tr('validation.email') };
      if (issue.validation === 'url') return { message: tr('validation.url') };
      return { message: tr('validation.generic') };

    case z.ZodIssueCode.too_small: {
      if (issue.type === 'string') {
        return issue.minimum === 1
          ? { message: tr('validation.required') }
          : { message: tr('validation.min', { count: Number(issue.minimum) }) };
      }
      if (issue.type === 'number') return { message: tr('validation.minNumber', { count: Number(issue.minimum) }) };
      return { message: tr('validation.generic') };
    }

    case z.ZodIssueCode.too_big: {
      if (issue.type === 'string') return { message: tr('validation.max', { count: Number(issue.maximum) }) };
      if (issue.type === 'number') return { message: tr('validation.maxNumber', { count: Number(issue.maximum) }) };
      return { message: tr('validation.generic') };
    }

    case z.ZodIssueCode.invalid_enum_value:
      return { message: tr('validation.invalidEnum') };

    default:
      return { message: ctx.defaultError };
  }
};
