import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { useFieldContext } from '../field';
import { SelectMenu, ChevronDown, ClearIcon } from './SelectMenu';
import type { SelectBaseProps, SelectOption } from './types';

const TRIGGER_SIZES = {
  sm: 'h-8 text-[13px] px-2.5',
  md: 'h-9.5 text-sm px-3',
};

interface SingleSelectProps<V extends string> extends SelectBaseProps<V> {
  value: V | null;
  onChange: (value: V | null) => void;
  /** fires with the live search term (used by AsyncSelect) */
  onSearchChange?: (query: string) => void;
}

/** Custom single-select. Never renders a native <select> UI. */
export function Select<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  loading,
  invalid,
  clearable,
  searchable,
  searchPlaceholder,
  emptyLabel,
  errorLabel,
  size = 'md',
  menuMatchTrigger = true,
  className,
  name,
  id,
  onSearchChange,
  ...aria
}: SingleSelectProps<V>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const field = useFieldContext();
  const showError = invalid ?? field?.hasError ?? false;
  const current = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const selected = useMemo(() => new Set(value ? [value] : []), [value]);

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <SelectMenu
        options={options}
        selected={selected}
        multiple={false}
        open={open}
        onOpenChange={setOpen}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        errorLabel={errorLabel}
        loading={loading}
        menuMatchTrigger={menuMatchTrigger}
        onSearchChange={onSearchChange}
        onPick={(v) => onChange(v === value ? value : v)}
        trigger={
          <button
            type="button"
            id={id ?? field?.id}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? field?.errorId : undefined}
            aria-label={aria['aria-label']}
            className={cn(
              'group flex w-full items-center gap-2 rounded-lg border bg-surface text-start transition-colors',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
              'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted',
              TRIGGER_SIZES[size],
              showError ? 'border-danger' : 'border-border',
              className,
            )}
          >
            {current?.icon && <span className="flex size-5 shrink-0 items-center justify-center">{current.icon}</span>}
            <span className={cn('min-w-0 flex-1 truncate', !current && 'text-text-subtle')}>
              {current?.label ?? placeholder}
            </span>
            {clearable && current && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="rounded p-0.5 text-text-subtle hover:text-text"
              >
                <ClearIcon className="size-3.5" />
              </span>
            )}
            <ChevronDown className="size-4 shrink-0 text-text-subtle transition-transform group-aria-expanded:rotate-180" />
          </button>
        }
      />
    </>
  );
}

/** Searchable single-select shorthand. */
export function SearchableSelect<V extends string = string>(props: SingleSelectProps<V>): React.ReactElement {
  return <Select {...props} searchable />;
}

export type { SelectOption };
