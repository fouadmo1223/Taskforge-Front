import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5">
      <div>
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }): React.ReactElement {
  return <div className={cn('mx-auto max-w-5xl px-6 py-6', className)}>{children}</div>;
}
