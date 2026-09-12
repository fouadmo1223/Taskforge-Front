import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFieldContext } from '../field';
import { SelectMenu, ChevronDown } from './SelectMenu';
import type { SelectBaseProps } from './types';

interface MultiSelectProps<V extends string> extends SelectBaseProps<V> {
  value: V[];
  onChange: (value: V[]) => void;
  maxChips?: number;
}

/** Custom multi-select with removable chips. */
export function MultiSelect<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  loading,
  invalid,
  searchable = true,
  searchPlaceholder,
  emptyLabel,
  errorLabel,
  menuMatchTrigger = true,
  className,
  name,
  id,
  maxChips = 4,
  ...aria
}: MultiSelectProps<V>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const field = useFieldContext();
  const showError = invalid ?? field?.hasError ?? false;
  const selected = useMemo(() => new Set(value), [value]);
  const chips = useMemo(
    () => options.filter((o) => selected.has(o.value)),
    [options, selected],
  );

  function toggle(v: V): void {
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const overflow = chips.length - maxChips;

  return (
    <>
      {name && value.map((v) => <input key={v} type="hidden" name={`${name}[]`} value={v} />)}
      <SelectMenu
        options={options}
        selected={selected}
        multiple
        open={open}
        onOpenChange={setOpen}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        errorLabel={errorLabel}
        loading={loading}
        menuMatchTrigger={menuMatchTrigger}
        onPick={toggle}
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
              'group flex min-h-9.5 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5 text-start transition-colors',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
              'disabled:cursor-not-allowed disabled:bg-surface-sunken',
              showError ? 'border-danger' : 'border-border',
              className,
            )}
          >
            {chips.length === 0 && <span className="px-1 text-sm text-text-subtle">{placeholder}</span>}
            {chips.slice(0, maxChips).map((o) => (
              <span
                key={o.value}
                className="inline-flex items-center gap-1 rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-text"
              >
                {o.icon}
                {o.label}
                {!disabled && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${o.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(o.value);
                    }}
                    className="text-text-subtle hover:text-text"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </span>
            ))}
            {overflow > 0 && <span className="text-xs text-text-muted">+{overflow}</span>}
            <ChevronDown className="ms-auto size-4 shrink-0 text-text-subtle transition-transform group-aria-expanded:rotate-180" />
          </button>
        }
      />
    </>
  );
}
