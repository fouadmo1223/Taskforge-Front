import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, X } from 'lucide-react';
import { DEPENDENCY_TYPES, type DependencyType } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import {
  useAddDependency,
  useRemoveDependency,
  useTaskDependencies,
  useTimeline,
} from '@/features/planning/planning.api';
import { Button, Select, toast } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import type { TaskView } from '@/features/board/board.api';

const TYPE_LABEL: Record<DependencyType, string> = {
  blocks: 'blocks',
  blocked_by: 'is blocked by',
  starts_after: 'starts after',
  finishes_before: 'finishes before',
  related_to: 'relates to',
  duplicate_of: 'duplicates',
};

export function DependenciesPanel({ task }: { task: TaskView }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const deps = useTaskDependencies(workspaceId, task.id);
  const timeline = useTimeline(workspaceId, task.projectId);
  const add = useAddDependency(workspaceId, task.id);
  const remove = useRemoveDependency(workspaceId, task.id);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<DependencyType>('blocks');
  const [toTaskId, setToTaskId] = useState<string | null>(null);

  const taskOptions = useMemo(
    () =>
      (timeline.data?.tasks ?? [])
        .filter((tk) => tk.id !== task.id)
        .map((tk) => ({ value: tk.id, label: tk.title, description: tk.key })),
    [timeline.data?.tasks, task.id],
  );
  const titleById = useMemo(
    () => new Map((timeline.data?.tasks ?? []).map((tk) => [tk.id, { key: tk.key, title: tk.title }])),
    [timeline.data?.tasks],
  );

  const submit = async (): Promise<void> => {
    if (!toTaskId) return;
    try {
      await add.mutateAsync({ toTaskId, type });
      setAdding(false);
      setToTaskId(null);
    } catch (err) {
      toast.error(t('task.dependencies'), err instanceof ApiError ? err.message : t('errors.generic'));
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('task.dependencies')} {(deps.data?.length ?? 0) > 0 && <span className="text-text-subtle">{deps.data!.length}</span>}
        </h3>
        {can('dependency.manage') && !adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            {t('common.create')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {(deps.data ?? []).map((d) => {
          const outgoing = d.fromTaskId === task.id;
          const otherId = outgoing ? d.toTaskId : d.fromTaskId;
          const other = titleById.get(otherId);
          const label = outgoing ? TYPE_LABEL[d.type] : `${TYPE_LABEL[d.type]} (from)`;
          return (
            <div key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-sunken">
              <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-muted">{label}</span>
              <ArrowRight className="size-3 shrink-0 text-text-subtle" />
              <span className="min-w-0 flex-1 truncate">
                <span className="me-1.5 font-mono text-[11px] text-text-subtle">{other?.key}</span>
                {other?.title ?? otherId}
              </span>
              {can('dependency.manage') && (
                <button onClick={() => remove.mutate(d.id)} className="text-text-subtle hover:text-danger">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {(deps.data?.length ?? 0) === 0 && !adding && <p className="text-sm text-text-subtle">{t('task.noDependencies')}</p>}
      </div>

      {adding && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border p-2.5">
          <div className="flex gap-2">
            <Select
              size="sm"
              className="w-40"
              value={type}
              onChange={(v) => v && setType(v as DependencyType)}
              options={DEPENDENCY_TYPES.map((d) => ({ value: d, label: TYPE_LABEL[d] }))}
            />
            <Select
              size="sm"
              className="flex-1"
              value={toTaskId}
              onChange={setToTaskId}
              options={taskOptions}
              searchable
              placeholder={t('task.pickTask')}
              loading={timeline.isLoading}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void submit()} loading={add.isPending} disabled={!toTaskId}>
              {t('common.create')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
