import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Flag, Plus, Trash2 } from 'lucide-react';
import type { MilestoneStatus } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
  useUpdateMilestone,
  type MilestoneView,
} from './planning.api';
import { Scrollable } from '@/components/ui/scrollable';
import { Button, DatePicker, Dialog, EmptyState, Field, Input, Select, Skeleton, confirm } from '@/components/ui';
import { feedback } from '@/lib/api/mutation-feedback';
import { cn } from '@/lib/cn';

const STATUS_TONE: Record<MilestoneStatus, string> = {
  planned: 'bg-surface-sunken text-text-muted',
  at_risk: 'bg-warning-soft text-warning',
  hit: 'bg-success-soft text-success',
  missed: 'bg-danger-soft text-danger',
};

export function MilestonesView({ projectId }: { projectId: string }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const q = useMilestones(workspaceId, projectId);
  const create = useCreateMilestone(workspaceId, projectId);
  const update = useUpdateMilestone(workspaceId, projectId);
  const del = useDeleteMilestone(workspaceId, projectId);
  const [open, setOpen] = useState(false);
  const form = useForm<{ name: string; date: string }>({ defaultValues: { name: '', date: '' } });

  const submit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync({ name: v.name, date: new Date(v.date).toISOString() });
      feedback(t, { success: t('common.created') }).onSuccess();
      setOpen(false);
      form.reset();
    } catch (e) {
      feedback(t).onError(e);
    }
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">{t('milestones.title')}</h2>
        {can('milestone.manage') && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            {t('milestones.create')}
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<Flag className="size-6" />} title={t('milestones.emptyTitle')} description={t('milestones.emptyBody')} />
      ) : (
        <Scrollable className="max-h-[70vh]">
          <ol className="relative ms-2 border-s border-border">
            {q.data!.map((m) => (
              <MilestoneRow
                key={m.id}
                m={m}
                editable={can('milestone.manage')}
                onStatus={(status) => update.mutate({ milestoneId: m.id, status }, feedback(t, { success: t('common.updated') }))}
                onDelete={async () => {
                  if (await confirm({ title: t('common.delete'), body: m.name, tone: 'danger', confirmLabel: t('common.delete') })) {
                    del.mutate(m.id, feedback(t, { success: t('common.deleted') }));
                  }
                }}
              />
            ))}
          </ol>
        </Scrollable>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('milestones.create')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4 py-1">
          <Field label={t('milestones.name')}>
            <Input autoFocus {...form.register('name', { required: true })} />
          </Field>
          <Field label={t('milestones.date')}>
            <Controller
              control={form.control}
              name="date"
              rules={{ required: true }}
              render={({ field }) => <DatePicker value={field.value} onChange={(v) => field.onChange(v ?? '')} />}
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}

function MilestoneRow({
  m,
  editable,
  onStatus,
  onDelete,
}: {
  m: MilestoneView;
  editable: boolean;
  onStatus: (s: MilestoneStatus) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const pct = m.progress.total ? (m.progress.done / m.progress.total) * 100 : 0;
  return (
    <li className="relative ms-6 py-3">
      <span className="absolute -start-[calc(1.5rem+1px)] top-4 size-3 -translate-x-1/2 rotate-45 border border-accent bg-accent/30 rtl:translate-x-1/2" />
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text">{m.name}</span>
          <span className="text-xs text-text-subtle">{format(new Date(m.date), 'MMM d, yyyy')}</span>
          {editable ? (
            <Select
              size="sm"
              className="ms-auto w-32"
              value={m.status}
              onChange={(v) => v && onStatus(v as MilestoneStatus)}
              options={(['planned', 'at_risk', 'hit', 'missed'] as MilestoneStatus[]).map((s) => ({ value: s, label: t(`milestones.status.${s}`) }))}
            />
          ) : (
            <span className={cn('ms-auto rounded-full px-2 py-0.5 text-xs font-medium', STATUS_TONE[m.status])}>
              {t(`milestones.status.${m.status}`)}
            </span>
          )}
          {editable && (
            <button onClick={onDelete} className="text-text-subtle hover:text-danger">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        {m.progress.total > 0 && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
            </div>
            <span className="mt-1 block text-[11px] text-text-subtle">
              {m.progress.done}/{m.progress.total} {t('milestones.tasksDone')}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
