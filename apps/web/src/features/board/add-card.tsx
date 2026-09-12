import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export function AddCard({
  onAdd,
  pending,
}: {
  onAdd: (title: string) => Promise<void> | void;
  pending?: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const submit = async (): Promise<void> => {
    const value = title.trim();
    if (!value) return;
    setTitle('');
    await onAdd(value);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-text-muted hover:bg-surface-sunken hover:text-text"
      >
        <Plus className="size-4" />
        {t('board.addCard')}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === 'Escape') {
            setOpen(false);
            setTitle('');
          }
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        placeholder={t('board.cardTitlePlaceholder')}
        className="scrollable w-full resize-none bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={() => void submit()}
          disabled={pending || !title.trim()}
          className={cn(
            'rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-contrast',
            (pending || !title.trim()) && 'opacity-50',
          )}
        >
          {t('board.addCard')}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTitle('');
          }}
          className="text-xs text-text-subtle hover:text-text"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
