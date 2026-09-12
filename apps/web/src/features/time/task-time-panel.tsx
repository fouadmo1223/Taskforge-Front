import { useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { UserSummary } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useAuth } from '@/features/auth/auth.store';
import type { TaskView } from '@/features/board/board.api';
import { Avatar, Button, Field, Input, NumberInput, toast } from '@/components/ui';
import {
  formatClock,
  formatDuration,
  useAddManualEntry,
  useCurrentTimer,
  useDeleteEntry,
  useTaskTimeEntries,
  useTimerActions,
} from './time.api';
import { cn } from '@/lib/cn';

export function TaskTimePanel({ task, usersById }: { task: TaskView; usersById: Map<string, UserSummary> }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const myId = useAuth((s) => s.user?.id ?? '');
  const timerQ = useCurrentTimer(workspaceId);
  const actions = useTimerActions(workspaceId);
  const entries = useTaskTimeEntries(workspaceId, task.id);
  const addManual = useAddManualEntry(workspaceId, task.id);
  const delEntry = useDeleteEntry(workspaceId, task.id);
  const [manualOpen, setManualOpen] = useState(false);
  const [minutes, setMinutes] = useState('30');
  const [note, setNote] = useState('');

  const timer = timerQ.data;
  const runningHere = timer?.taskId === task.id;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('time.title')} <span className="text-text-subtle">{formatDuration(task.loggedHours * 3600)}</span>
        </h3>
        {can('time.log') && (
          <div className="flex items-center gap-1.5">
            {runningHere ? (
              <>
                <span className="font-mono text-xs text-text">{formatClock(timer!.elapsedSeconds)}</span>
                {timer!.state === 'running' ? (
                  <Button size="sm" variant="ghost" onClick={() => actions.pause.mutate()}>
                    <Pause className="size-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => actions.resume.mutate()}>
                    <Play className="size-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => actions.stop.mutate(undefined, { onSuccess: () => toast.success(t('time.logged')) })}
                >
                  <Square className="size-3.5" />
                  {t('time.stop')}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  actions.start.mutate(
                    { taskId: task.id },
                    { onError: (e) => toast.error(errorText(e, t)) },
                  )
                }
              >
                <Play className="size-3.5" />
                {t('time.start')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setManualOpen((v) => !v)}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {manualOpen && (
        <form
          className="mb-2 flex items-end gap-2 rounded-lg border border-border p-2.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const m = Number(minutes);
            if (!m || m <= 0) return;
            await addManual
              .mutateAsync({ startedAt: new Date().toISOString(), minutes: m, description: note || undefined })
              .catch(() => toast.error(t('errors.generic')));
            setManualOpen(false);
            setNote('');
          }}
        >
          <Field label={t('time.minutes')} className="w-24">
            <NumberInput size="sm" min={1} value={Number(minutes) || null} onChange={(v) => setMinutes(String(v ?? ''))} />
          </Field>
          <div className="flex-1">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('time.notePlaceholder')} />
          </div>
          <Button size="sm" type="submit" loading={addManual.isPending}>
            {t('common.save')}
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-1">
        {(entries.data ?? []).map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-sunken">
            <Avatar name={usersById.get(e.userId)?.name ?? '?'} size="xs" />
            <span className="font-mono text-xs text-text">{formatDuration(e.durationSeconds)}</span>
            <span className="min-w-0 flex-1 truncate text-text-muted">{e.description || '—'}</span>
            <span className={cn('shrink-0 text-[11px]', e.source === 'timer' ? 'text-primary' : 'text-text-subtle')}>{e.source}</span>
            <span className="shrink-0 text-[11px] text-text-subtle">{format(new Date(e.startedAt), 'MMM d')}</span>
            {e.userId === myId && !e.locked && can('time.log') && (
              <button onClick={() => delEntry.mutate(e.id)} className="text-text-subtle hover:text-danger">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {(entries.data?.length ?? 0) === 0 && <p className="text-sm text-text-subtle">{t('time.none')}</p>}
      </div>
    </section>
  );
}
