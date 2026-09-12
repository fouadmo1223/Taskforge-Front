import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Square } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useRealtimeEvent } from '@/lib/realtime/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentTimer, useTimerActions, formatClock } from './time.api';
import { cn } from '@/lib/cn';
import { toast } from '@/components/ui';

/** Compact running-timer control in the app-shell header. */
export function TimerWidget(): React.ReactElement | null {
  const { t } = useTranslation();
  const { workspaceId, slug } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const timerQ = useCurrentTimer(workspaceId);
  const actions = useTimerActions(workspaceId);
  const [tick, setTick] = useState(0);

  useRealtimeEvent<{ timer: unknown }>('presence.updated', () => {
    void qc.invalidateQueries({ queryKey: ['timer', workspaceId] });
  });

  const timer = timerQ.data;
  useEffect(() => {
    if (timer?.state !== 'running') return;
    const h = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(h);
  }, [timer?.state]);

  if (!timer) return null;

  void tick;
  // `elapsedSeconds` is accurate as of the fetch; add wall-clock since then while running.
  const sinceFetch = timer.state === 'running' ? (Date.now() - timerQ.dataUpdatedAt) / 1000 : 0;
  const shown = Math.max(0, Math.floor(timer.elapsedSeconds + sinceFetch));

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2 py-1',
        timer.state === 'running' ? 'border-danger/40 bg-danger-soft/50' : 'border-border bg-surface-sunken',
      )}
    >
      <button
        onClick={() => navigate(`/w/${slug}/projects/${timer.projectId}?task=${timer.taskId}`)}
        className="max-w-32 truncate text-xs font-medium text-text"
        title={timer.description || t('time.timer')}
      >
        {timer.description || t('time.timer')}
      </button>
      <span className="font-mono text-xs tabular-nums text-text">{formatClock(shown)}</span>
      {timer.state === 'running' ? (
        <button onClick={() => actions.pause.mutate()} className="rounded p-1 text-text-muted hover:text-text" aria-label={t('time.pause')}>
          <Pause className="size-3.5" />
        </button>
      ) : (
        <button onClick={() => actions.resume.mutate()} className="rounded p-1 text-text-muted hover:text-text" aria-label={t('time.resume')}>
          <Play className="size-3.5" />
        </button>
      )}
      <button
        onClick={() =>
          actions.stop.mutate(undefined, {
            onSuccess: () => toast.success(t('time.logged')),
            onError: () => toast.error(t('errors.generic')),
          })
        }
        className="rounded p-1 text-text-muted hover:text-danger"
        aria-label={t('time.stop')}
      >
        <Square className="size-3.5" />
      </button>
    </div>
  );
}
