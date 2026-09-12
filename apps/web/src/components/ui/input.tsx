import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { useFieldContext } from './field';

const base =
  'w-full rounded-lg border bg-surface text-sm text-text placeholder:text-text-subtle transition-colors ' +
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leading, trailing, id, ...props }, ref) => {
    const field = useFieldContext();
    const showError = invalid ?? field?.hasError ?? false;
    const control = (
      <input
        ref={ref}
        id={id ?? field?.id}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? field?.errorId : undefined}
        className={cn(
          base,
          'h-9.5 px-3',
          leading && 'ps-9',
          trailing && 'pe-9',
          showError && 'border-danger focus:border-danger focus:ring-danger/20',
          !showError && 'border-border',
          className,
        )}
        {...props}
      />
    );
    if (!leading && !trailing) return control;
    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex w-9 items-center justify-center text-text-subtle">
            {leading}
          </span>
        )}
        {control}
        {trailing && (
          <span className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-text-subtle">
            {trailing}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, id, rows = 4, ...props }, ref) => {
    const field = useFieldContext();
    const showError = invalid ?? field?.hasError ?? false;
    return (
      <textarea
        ref={ref}
        id={id ?? field?.id}
        rows={rows}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? field?.errorId : undefined}
        className={cn(
          base,
          'scrollable resize-y px-3 py-2 leading-relaxed',
          showError ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
