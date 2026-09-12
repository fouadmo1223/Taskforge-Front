import { cn } from '@/lib/cn';

export function Spinner({ className, label }: { className?: string; label?: string }): React.ReactElement {
  return (
    <span
      role="status"
      aria-label={label ?? 'Loading'}
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em]',
        className,
      )}
    />
  );
}
