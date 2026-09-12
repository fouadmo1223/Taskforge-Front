import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ar } from 'date-fns/locale/ar';
import { enUS } from 'date-fns/locale/en-US';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFieldContext } from './field';

interface DatePickerProps {
  /** ISO date (`yyyy-MM-dd`) or empty string / null */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  id?: string;
}

const iso = (d: Date): string => format(d, 'yyyy-MM-dd');
const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Fully custom, RTL- and locale-aware calendar. Replaces native `<input type="date">`. */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  clearable = true,
  placeholder,
  invalid,
  className,
  size = 'md',
  id,
}: DatePickerProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const field = useFieldContext();
  const locale = i18n.resolvedLanguage?.startsWith('ar') ? ar : enUS;
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(viewMonth), { locale });
    const gridEnd = endOfWeek(endOfMonth(viewMonth), { locale });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth, locale]);

  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(new Date(), { locale });
    return Array.from({ length: 7 }, (_, i) => format(addDaysSafe(start, i), 'EEEEE', { locale }));
  }, [locale]);

  const minD = parse(min ?? null);
  const maxD = parse(max ?? null);
  const outOfRange = (d: Date): boolean =>
    (minD !== null && iso(d) < iso(minD)) || (maxD !== null && iso(d) > iso(maxD));

  const showError = invalid ?? field?.hasError ?? false;

  return (
    <Popover.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id ?? field?.id}
          disabled={disabled}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? field?.errorId : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border bg-surface text-start outline-none transition-colors',
            size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-9.5 px-3',
            'focus:border-primary focus:ring-2 focus:ring-primary/20',
            showError ? 'border-danger' : 'border-border',
            disabled && 'cursor-not-allowed opacity-60',
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-text-subtle" />
          <span className={cn('flex-1 truncate', !selected && 'text-text-subtle')}>
            {selected ? format(selected, 'PP', { locale }) : (placeholder ?? t('datePicker.placeholder'))}
          </span>
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={t('common.remove')}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="rounded p-0.5 text-text-subtle hover:bg-surface-sunken hover:text-text"
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      </Popover.Trigger>

      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild align="start" sideOffset={6} forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -2 }}
                transition={{ duration: 0.14, ease: [0.25, 1, 0.5, 1] }}
                className="z-[130] w-[17rem] rounded-xl border border-border bg-surface-elevated p-3 shadow-pop"
              >
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewMonth((m) => addMonths(m, -1))}
                    className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken rtl:rotate-180"
                    aria-label={t('datePicker.prevMonth')}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-sm font-semibold text-text">{format(viewMonth, 'MMMM yyyy', { locale })}</span>
                  <button
                    type="button"
                    onClick={() => setViewMonth((m) => addMonths(m, 1))}
                    className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken rtl:rotate-180"
                    aria-label={t('datePicker.nextMonth')}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-text-subtle">
                  {weekdayLabels.map((w, i) => (
                    <div key={i} className="py-1">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {days.map((d) => {
                    const isSel = selected && isSameDay(d, selected);
                    const dim = !isSameMonth(d, viewMonth);
                    const disabledDay = outOfRange(d);
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        disabled={disabledDay}
                        onClick={() => {
                          onChange(iso(d));
                          setOpen(false);
                        }}
                        className={cn(
                          'flex h-8 items-center justify-center rounded-lg text-sm transition-colors',
                          isSel && 'bg-primary font-semibold text-primary-contrast',
                          !isSel && isToday(d) && 'font-semibold text-primary',
                          !isSel && !disabledDay && 'hover:bg-surface-sunken',
                          dim && !isSel && 'text-text-subtle',
                          disabledDay && 'cursor-not-allowed opacity-30',
                        )}
                      >
                        {format(d, 'd', { locale })}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      if (!outOfRange(today)) {
                        onChange(iso(today));
                        setOpen(false);
                      }
                    }}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
                  >
                    {t('datePicker.today')}
                  </button>
                  {clearable && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(null);
                        setOpen(false);
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-text-muted hover:bg-surface-sunken"
                    >
                      {t('datePicker.clear')}
                    </button>
                  )}
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

function addDaysSafe(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
