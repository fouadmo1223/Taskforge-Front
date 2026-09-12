import { useEffect } from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, Loader2, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
  /** how many identical toasts were collapsed into this one */
  count: number;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'duration' | 'count'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

/** identical tone+title+description within this window bump the existing toast instead of stacking a duplicate */
const DEDUPE_WINDOW_MS = 4000;
const lastPushed = new Map<string, { id: string; at: number }>();

const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const key = `${t.tone}:${t.title}:${t.description ?? ''}`;
    const prev = lastPushed.get(key);
    const now = Date.now();
    if (prev && now - prev.at < DEDUPE_WINDOW_MS && get().items.some((i) => i.id === prev.id)) {
      lastPushed.set(key, { id: prev.id, at: now });
      set((s) => ({ items: s.items.map((i) => (i.id === prev.id ? { ...i, count: i.count + 1 } : i)) }));
      return prev.id;
    }
    const id = crypto.randomUUID();
    lastPushed.set(key, { id, at: now });
    set((s) => ({ items: [...s.items, { id, duration: 5000, count: 1, ...t }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

function emit(tone: ToastTone, title: string, description?: string, duration?: number): string {
  return useToastStore.getState().push({ tone, title, description, duration });
}

export const toast = {
  success: (title: string, description?: string) => emit('success', title, description),
  error: (title: string, description?: string) => emit('error', title, description, 7000),
  warning: (title: string, description?: string) => emit('warning', title, description),
  info: (title: string, description?: string) => emit('info', title, description),
  /** persists until dismissed (or replaced) — pair with `dismiss` or use `promise` */
  loading: (title: string, description?: string) => emit('loading', title, description, Number.POSITIVE_INFINITY),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  /** shows a loading toast for the duration of `p`, then swaps it for success/error */
  promise: async <T,>(
    p: Promise<T>,
    opts: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) },
  ): Promise<T> => {
    const id = emit('loading', opts.loading, undefined, Number.POSITIVE_INFINITY);
    try {
      const result = await p;
      useToastStore.getState().dismiss(id);
      emit('success', typeof opts.success === 'function' ? opts.success(result) : opts.success);
      return result;
    } catch (err) {
      useToastStore.getState().dismiss(id);
      emit('error', typeof opts.error === 'function' ? opts.error(err) : opts.error, undefined, 7000);
      throw err;
    }
  },
};

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
  loading: Loader2,
};
const ACCENT = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  loading: 'text-text-muted',
};

function ToastRow({ item }: { item: ToastItem }): React.ReactElement {
  const dismiss = useToastStore((s) => s.dismiss);
  const Icon = ICONS[item.tone];
  useEffect(() => {
    if (!Number.isFinite(item.duration)) return;
    const handle = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(handle);
    // re-arm the timer whenever a duplicate bumps this toast (duration/count change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.duration, item.count, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-border bg-surface-elevated p-3.5 shadow-pop"
      role="status"
    >
      <Icon className={cn('mt-0.5 size-4.5 shrink-0', ACCENT[item.tone], item.tone === 'loading' && 'animate-spin')} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">
          {item.title}
          {item.count > 1 && <span className="ms-1.5 text-xs font-normal text-text-subtle">×{item.count}</span>}
        </p>
        {item.description && <p className="mt-0.5 text-xs text-text-muted">{item.description}</p>}
      </div>
      {item.tone !== 'loading' && (
        <button
          onClick={() => dismiss(item.id)}
          className="rounded p-0.5 text-text-subtle hover:text-text"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}

/** Mount once near the app root. */
export function ToastHost(): React.ReactElement {
  const items = useToastStore((s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[100] flex flex-col items-end gap-2">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}
