import { createContext, useContext, useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldCtx {
  id: string;
  errorId: string;
  hasError: boolean;
}
const Ctx = createContext<FieldCtx | null>(null);

export function useFieldContext(): FieldCtx | null {
  return useContext(Ctx);
}

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldProps): React.ReactElement {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <Ctx.Provider value={{ id, errorId, hasError: Boolean(error) }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-medium uppercase tracking-wide text-text-muted"
          >
            {label}
            {required && <span className="ms-1 text-danger">*</span>}
          </label>
        )}
        {children}
        {error ? (
          <p id={errorId} role="alert" className="flex items-start gap-1 text-xs text-danger">
            <AlertCircle className="mt-0.5 size-3 shrink-0" />
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-text-subtle">{hint}</p>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
