import { forwardRef, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFieldContext } from './field';

interface NumberInputProps {
  value: number | '' | null | undefined;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  id?: string;
  'aria-label'?: string;
}

/** Number field with real stepper buttons instead of the browser's tiny spinner. */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onChange, min, max, step = 1, precision, disabled, invalid, placeholder, className, size = 'md', id, ...rest },
  ref,
) {
  const field = useFieldContext();
  const showError = invalid ?? field?.hasError ?? false;
  const num = value === '' || value === null || value === undefined ? null : Number(value);

  const clamp = useCallback(
    (n: number): number => {
      let v = n;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      if (precision !== undefined) v = Number(v.toFixed(precision));
      return v;
    },
    [min, max, precision],
  );

  const bump = (dir: 1 | -1): void => {
    const base = num ?? min ?? 0;
    onChange(clamp(base + dir * step));
  };

  const canDec = !disabled && (num === null || min === undefined || num > min);
  const canInc = !disabled && (num === null || max === undefined || num < max);

  return (
    <div
      className={cn(
        'flex items-stretch overflow-hidden rounded-lg border bg-surface transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        showError ? 'border-danger' : 'border-border',
        disabled && 'opacity-60',
        className,
      )}
    >
      <StepButton onClick={() => bump(-1)} disabled={!canDec} aria-label="Decrease" size={size}>
        <Minus className="size-3.5" />
      </StepButton>
      <input
        ref={ref}
        id={id ?? field?.id}
        type="number"
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={num ?? ''}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? field?.errorId : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === '' ? null : clamp(Number(raw)));
        }}
        onBlur={(e) => {
          if (e.target.value !== '') onChange(clamp(Number(e.target.value)));
        }}
        className={cn(
          'min-w-0 flex-1 border-0 bg-transparent text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          size === 'sm' ? 'h-8 text-sm' : 'h-9.5',
        )}
        {...rest}
      />
      <StepButton onClick={() => bump(1)} disabled={!canInc} aria-label="Increase" size={size}>
        <Plus className="size-3.5" />
      </StepButton>
    </div>
  );
});

function StepButton({
  children,
  onClick,
  disabled,
  size,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  size: 'sm' | 'md';
  'aria-label': string;
}): React.ReactElement {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-sunken hover:text-text disabled:opacity-40 disabled:hover:bg-transparent',
        size === 'sm' ? 'w-8' : 'w-9',
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
