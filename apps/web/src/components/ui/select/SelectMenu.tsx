import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Spinner } from '../spinner';
import { Scrollable } from '../scrollable';
import type { SelectOption } from './types';

interface SelectMenuProps<V extends string> {
  options: SelectOption<V>[];
  selected: Set<V>;
  onPick: (value: V) => void;
  multiple?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  errorLabel?: string;
  loading?: boolean;
  menuMatchTrigger?: boolean;
  onSearchChange?: (q: string) => void;
}

/**
 * Shared listbox popover for every Select variant. Fully custom visuals on top of
 * Radix Popover (portal + collision handling only). Keyboard: ↑/↓ move, Home/End
 * jump, Enter/Space pick, Esc close, type-to-search when `searchable`.
 */
export function SelectMenu<V extends string>({
  options,
  selected,
  onPick,
  multiple,
  open,
  onOpenChange,
  trigger,
  searchable,
  searchPlaceholder = 'Search…',
  emptyLabel = 'No results',
  errorLabel,
  loading,
  menuMatchTrigger = true,
  onSearchChange,
}: SelectMenuProps<V>): React.ReactElement {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** true when the active option last changed via hover — skip auto-scroll so the wheel isn't fought */
  const pointerNav = useRef(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SelectOption<V>[]>();
    for (const opt of filtered) {
      const key = opt.group ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(opt);
    }
    return [...groups.entries()];
  }, [filtered]);

  const flat = filtered;

  function move(delta: number): void {
    setActiveIndex((i) => {
      let next = i;
      for (let step = 0; step < flat.length; step += 1) {
        next = (next + delta + flat.length) % flat.length;
        if (!flat[next]?.disabled) break;
      }
      return next;
    });
  }

  useEffect(() => {
    if (pointerNav.current) {
      pointerNav.current = false;
      return;
    }
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function onKeyDown(e: React.KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(flat.length - 1);
        break;
      case 'Enter':
      case ' ': {
        if (e.key === ' ' && searchable) break;
        e.preventDefault();
        const opt = flat[activeIndex];
        if (opt && !opt.disabled) {
          onPick(opt.value);
          if (!multiple) onOpenChange(false);
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        break;
      default:
        break;
    }
  }

  let runningIndex = -1;

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          role="listbox"
          aria-multiselectable={multiple}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            if (searchable) e.preventDefault();
          }}
          className={cn(
            // above drawers (z-60) and the chat panel (z-85) so the menu is never clipped behind them
            'z-[200] overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-pop',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
          style={{
            width: menuMatchTrigger ? 'var(--radix-popover-trigger-width)' : undefined,
            minWidth: menuMatchTrigger ? undefined : '15rem',
            maxHeight: 'min(22rem, var(--radix-popover-content-available-height))',
          }}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 shrink-0 text-text-subtle" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                  onSearchChange?.(e.target.value);
                }}
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded p-0.5 text-text-subtle hover:text-text"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <Scrollable ref={listRef} className="max-h-72 py-1.5" role="presentation">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-text-muted">
                <Spinner /> Loading…
              </div>
            ) : errorLabel ? (
              <div className="px-3 py-6 text-center text-sm text-danger">{errorLabel}</div>
            ) : flat.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-text-muted">{emptyLabel}</div>
            ) : (
              grouped.map(([groupKey, groupOpts]) => (
                <div key={groupKey || '_'} role="group" aria-label={groupKey || undefined}>
                  {groupKey && (
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                      {groupKey}
                    </div>
                  )}
                  {groupOpts.map((opt) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const isSelected = selected.has(opt.value);
                    const isActive = index === activeIndex;
                    return (
                      <div
                        key={opt.value}
                        data-index={index}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={opt.disabled}
                        onMouseEnter={() => {
                          pointerNav.current = true;
                          setActiveIndex(index);
                        }}
                        onClick={() => {
                          if (opt.disabled) return;
                          onPick(opt.value);
                          if (!multiple) onOpenChange(false);
                        }}
                        className={cn(
                          'mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                          isActive && 'bg-surface-sunken',
                          opt.disabled && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        {opt.icon && <span className="flex size-5 shrink-0 items-center justify-center">{opt.icon}</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-text">{opt.label}</span>
                          {opt.description && (
                            <span className="block truncate text-xs text-text-subtle">{opt.description}</span>
                          )}
                        </span>
                        {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </Scrollable>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export { ChevronDown, X as ClearIcon };
