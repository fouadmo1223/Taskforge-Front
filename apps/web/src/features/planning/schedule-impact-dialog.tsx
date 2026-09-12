import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Dialog } from '@/components/ui/dialog';
import { Button, toast } from '@/components/ui';
import { applyScheduleShift, type ScheduleImpactRow } from './planning.api';

interface Props {
  workspaceId: string;
  rows: ScheduleImpactRow[] | null;
  onClose: () => void;
  onApplied: () => void;
}

/** "N dependent tasks are affected." — update all / review individually / ignore. */
export function ScheduleImpactDialog({ workspaceId, rows, onClose, onApplied }: Props): React.ReactElement {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rows) setSelected(new Set(rows.map((r) => r.taskId)));
  }, [rows]);

  const apply = async (): Promise<void> => {
    if (!rows) return;
    const shifts = rows
      .filter((r) => selected.has(r.taskId))
      .map((r) => ({ taskId: r.taskId, startDate: r.proposedStart, dueDate: r.proposedDue }));
    if (shifts.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await applyScheduleShift(workspaceId, shifts);
      toast.success(t('impact.applied', { count: res.updated }));
      onApplied();
      onClose();
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={Boolean(rows && rows.length > 0)}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t('impact.title', { count: rows?.length ?? 0 })}
      description={t('impact.subtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('impact.ignore')}
          </Button>
          <Button onClick={() => void apply()} loading={busy} disabled={selected.size === 0}>
            {t('impact.updateSelected', { count: selected.size })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1 py-1">
        {(rows ?? []).map((r) => (
          <label
            key={r.taskId}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-sunken"
          >
            <input
              type="checkbox"
              checked={selected.has(r.taskId)}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  e.target.checked ? next.add(r.taskId) : next.delete(r.taskId);
                  return next;
                })
              }
              className="size-4 rounded border-border"
            />
            <span className="font-mono text-[11px] text-text-subtle">{r.key}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-text">{r.title}</span>
            <span className="shrink-0 text-xs text-text-muted">
              {r.currentDue ? format(new Date(r.currentDue), 'MMM d') : '—'}
              {' → '}
              <span className="font-medium text-text">{format(new Date(r.proposedDue), 'MMM d')}</span>
              {r.shiftDays > 0 && <span className="ms-1 text-warning">+{r.shiftDays}d</span>}
            </span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}
