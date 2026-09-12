import type { TFunction } from 'i18next';
import { toast } from '@/components/ui';
import { errorText } from './errors';

type Opt = string | false | undefined;

/**
 * Standard toast callbacks for a mutation. Spread into a `.mutate(vars, …)` call
 * or a `useMutation({ … })` options object:
 *
 *   update.mutate(vars, feedback(t));                       // "Saved" + error toast
 *   update.mutate(vars, feedback(t, { success: t('x') }));  // custom success text
 *   del.mutate(id, feedback(t, { success: t('common.deleted') }));
 *   create.mutate(body, feedback(t, { success: false }));   // error toast only
 *
 * `errorText` already localises the server's `ApiError.code` for non-English
 * locales, so every page gets a consistent, translated response toast.
 */
export function feedback(
  t: TFunction,
  opts: { success?: Opt; error?: Opt } = {},
): { onError: (e: unknown) => void; onSuccess: () => void } {
  return {
    onError: (e: unknown) => {
      if (opts.error === false) return;
      toast.error(typeof opts.error === 'string' ? opts.error : errorText(e, t));
    },
    onSuccess: () => {
      if (opts.success === false) return;
      toast.success(typeof opts.success === 'string' ? opts.success : t('common.saved'));
    },
  };
}
