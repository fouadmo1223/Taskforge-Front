/** Taskforge's mark: a "T" struck from two bars, plus a spark — forging work into shape. */
export function BrandMark({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="6" y="7" width="20" height="6" rx="2.5" fill="currentColor" />
      <rect x="13" y="7" width="6" height="18" rx="2.5" fill="currentColor" />
      <circle cx="24.5" cy="24.5" r="3" fill="currentColor" fillOpacity="0.55" />
    </svg>
  );
}
