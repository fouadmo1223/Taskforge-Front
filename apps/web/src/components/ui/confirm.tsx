import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Dialog } from './dialog';
import { Button } from './button';

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmState {
  current: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  _close: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ current: { ...opts, resolve } });
    }),
  _close: (ok) => {
    get().current?.resolve(ok);
    set({ current: null });
  },
}));

/** Imperative confirm — replaces window.confirm everywhere. */
export const confirm = (opts: ConfirmOptions): Promise<boolean> => useConfirmStore.getState().ask(opts);

/** Mount once near the app root. */
export function ConfirmHost(): React.ReactElement {
  const { t } = useTranslation();
  const current = useConfirmStore((s) => s.current);
  const close = useConfirmStore((s) => s._close);

  return (
    <Dialog
      open={Boolean(current)}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
      size="sm"
      title={
        current?.tone === 'danger' ? (
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-danger-soft text-danger">
              <TriangleAlert className="size-4" />
            </span>
            {current.title}
          </span>
        ) : (
          current?.title
        )
      }
      description={current?.body}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            {current?.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={current?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
            {current?.confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <></>
    </Dialog>
  );
}
