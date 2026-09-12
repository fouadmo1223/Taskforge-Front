import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-contrast hover:bg-primary-hover shadow-xs disabled:bg-primary/50',
  secondary: 'bg-surface-sunken text-text hover:bg-border/60 border border-border',
  outline: 'border border-border-strong text-text hover:bg-surface-sunken',
  ghost: 'text-text-muted hover:bg-surface-sunken hover:text-text',
  subtle: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
  icon: 'size-9.5 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, block, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner className={size === 'icon' ? '' : '-ms-0.5'} />}
      {!(loading && size === 'icon') && children}
    </button>
  ),
);
Button.displayName = 'Button';
