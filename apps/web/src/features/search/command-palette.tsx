import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import * as RDialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { FileText, FolderKanban, MessageSquare, Search } from 'lucide-react';
import { create } from 'zustand';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useSearch, type SearchHit } from '@/features/planning/planning.api';
import { Scrollable } from '@/components/ui/scrollable';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

interface PaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
}
export const useCommandPalette = create<PaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const ICONS = { task: FileText, project: FolderKanban, comment: MessageSquare };

export function CommandPalette(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId, slug } = useWorkspace();
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useCommandPalette.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setDebounced('');
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(h);
  }, [query]);

  const results = useSearch(workspaceId, debounced);
  const hits = useMemo(() => results.data ?? [], [results.data]);

  const go = (hit: SearchHit): void => {
    setOpen(false);
    if (hit.type === 'project') navigate(`/w/${slug}/projects/${hit.projectId}`);
    else if (hit.projectId && hit.taskId) navigate(`/w/${slug}/projects/${hit.projectId}?task=${hit.taskId}`);
  };

  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]"
              />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="fixed left-1/2 top-[12vh] z-[95] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-lg"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, hits.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter' && hits[active]) {
                    e.preventDefault();
                    go(hits[active]);
                  }
                }}
              >
                <RDialog.Title className="sr-only">{t('common.search')}</RDialog.Title>
                <div className="flex items-center gap-2.5 border-b border-border px-4">
                  <Search className="size-4 shrink-0 text-text-subtle" />
                  <input
                    ref={inputRef}
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    placeholder={t('search.placeholder')}
                    className="h-12 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
                  />
                  {results.isFetching && <Spinner className="size-3.5 text-text-subtle" />}
                </div>
                <Scrollable className="max-h-80 p-1.5">
                  {debounced.length < 2 ? (
                    <p className="px-3 py-6 text-center text-sm text-text-subtle">{t('search.hint')}</p>
                  ) : hits.length === 0 && !results.isFetching ? (
                    <p className="px-3 py-6 text-center text-sm text-text-subtle">{t('search.empty')}</p>
                  ) : (
                    hits.map((hit, i) => {
                      const Icon = ICONS[hit.type];
                      return (
                        <button
                          key={`${hit.type}-${hit.id}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(hit)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start',
                            i === active && 'bg-surface-sunken',
                          )}
                        >
                          <Icon className="size-4 shrink-0 text-text-subtle" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-text">{hit.title}</span>
                            {hit.subtitle && <span className="block truncate text-xs text-text-subtle">{hit.subtitle}</span>}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-subtle">{hit.type}</span>
                        </button>
                      );
                    })
                  )}
                </Scrollable>
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
