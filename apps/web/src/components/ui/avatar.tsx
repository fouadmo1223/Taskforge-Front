import { useMemo } from 'react';
import type { CloudinaryAsset } from '@flowdesk/types';
import { cn } from '@/lib/cn';

const PALETTE = [
  'bg-[#6366f1]',
  'bg-[#0ea5e9]',
  'bg-[#10b981]',
  'bg-[#f59e0b]',
  'bg-[#ef4444]',
  'bg-[#8b5cf6]',
  'bg-[#ec4899]',
  'bg-[#14b8a6]',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function hashIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % mod;
}

const SIZES = { xs: 'size-5 text-[9px]', sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' };

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: CloudinaryAsset | string | null;
  size?: keyof typeof SIZES;
  className?: string;
}): React.ReactElement {
  const url = typeof src === 'string' ? src : (src?.secureUrl ?? null);
  const color = useMemo(() => PALETTE[hashIndex(name, PALETTE.length)]!, [name]);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        SIZES[size],
        !url && color,
        className,
      )}
      title={name}
    >
      {url ? <img src={url} alt={name} className="size-full object-cover" /> : initials(name)}
    </span>
  );
}
