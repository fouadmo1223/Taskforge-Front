import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GOAL_TYPES, type GoalStatus, type GoalType } from '@flowdesk/types';
import { Plus, Target, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { feedback } from '@/lib/api/mutation-feedback';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, DatePicker, Dialog, EmptyState, ErrorState, Field, Input, NumberInput, Select, Skeleton, Spinner, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useSetKeyResults,
  useUpdateGoal,
  type GoalView,
} from '@/features/strategy/strategy.api';

const STATUS_TONE: Record<GoalStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  on_track: 'success',
  at_risk: 'warning',
  off_track: 'danger',
  achieved: 'success',
  missed: 'danger',
};

export function GoalsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const goals = useGoals(workspaceId);
  const create = useCreateGoal(workspaceId);
  const update = useUpdateGoal(workspaceId);
  const setKrs = useSetKeyResults(workspaceId);
  const del = useDeleteGoal(workspaceId);
  const manage = can('goal.manage');

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', type: 'percent' as GoalType, target: '100', unit: '%', dueDate: '' });

  return (
    <>
      <PageHeader
        title={t('strategy.goals')}
        description={t('strategy.goalsDesc')}
        actions={
          manage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('strategy.newGoal')}
            </Button>
          )
        }
      />
      <PageBody className="space-y-3">
        {goals.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : goals.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void goals.refetch()} />
        ) : goals.data!.length === 0 ? (
          <EmptyState title={t('strategy.noGoals')} icon={<Target className="size-5" />} />
        ) : (
          goals.data!.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              manage={manage}
              busy={
                (update.isPending && (update.variables as { id?: string } | undefined)?.id === g.id) ||
                (setKrs.isPending && (setKrs.variables as { id?: string } | undefined)?.id === g.id) ||
                (del.isPending && del.variables === g.id)
              }
              onProgress={(current) => update.mutate({ id: g.id, current }, feedback(t, { success: t('common.updated') }))}
              onStatus={(status) => update.mutate({ id: g.id, status }, feedback(t, { success: t('common.updated') }))}
              onKrs={(krs) => setKrs.mutate({ id: g.id, keyResults: krs }, feedback(t))}
              onDelete={() => del.mutate(g.id, feedback(t, { success: t('common.deleted') }))}
            />
          ))
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('strategy.newGoal')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!draft.title.trim()}
              onClick={() =>
                create.mutate(
                  {
                    title: draft.title.trim(),
                    description: draft.description.trim(),
                    type: draft.type,
                    target: Number(draft.target) || (draft.type === 'binary' ? 1 : 100),
                    unit: draft.unit,
                    dueDate: draft.dueDate || null,
                  },
                  {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.created') }).onSuccess();
                      setCreating(false);
                      setDraft({ title: '', description: '', type: 'percent', target: '100', unit: '%', dueDate: '' });
                    },
                  },
                )
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
          <Field label={t('strategy.goalTitle')} className="sm:col-span-2">
            <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label={t('external.forms.formDescription')} className="sm:col-span-2">
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label={t('strategy.goalType')}>
            <Select
              value={draft.type}
              onChange={(v) => setDraft({ ...draft, type: v ?? 'percent', unit: v === 'percent' ? '%' : '' })}
              options={GOAL_TYPES.map((x) => ({ value: x, label: t(`strategy.goalTypeLabel.${x}`) }))}
            />
          </Field>
          <Field label={t('strategy.target')}>
            <Input type="number" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
          </Field>
          <Field label={t('strategy.dueDate')} className="sm:col-span-2">
            <DatePicker value={draft.dueDate} onChange={(v) => setDraft({ ...draft, dueDate: v ?? '' })} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

function GoalCard({
  goal: g,
  manage,
  busy,
  onProgress,
  onStatus,
  onKrs,
  onDelete,
}: {
  goal: GoalView;
  manage: boolean;
  busy: boolean;
  onProgress: (current: number) => void;
  onStatus: (status: GoalStatus) => void;
  onKrs: (krs: Array<{ title: string; current: number; target: number }>) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(String(g.current));
  const [krEdit, setKrEdit] = useState(false);
  const [krs, setKrs] = useState(g.keyResults.map((k) => ({ title: k.title, current: k.current, target: k.target })));

  return (
    <div className={cn('rounded-xl border border-border bg-surface p-4 transition-opacity', busy && 'pointer-events-none opacity-60')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text">{g.title}</span>
        <Badge tone={STATUS_TONE[g.status]}>{t(`strategy.goalStatus.${g.status}`)}</Badge>
        {busy && <Spinner className="size-3.5 text-text-subtle" />}
        <span className="ms-auto text-sm font-semibold text-text">{Math.round(g.progress * 100)}%</span>
        {manage && (
          <button onClick={onDelete} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-danger">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {g.description && <p className="mt-1 text-sm text-text-muted">{g.description}</p>}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div className={cn('h-full', g.progress >= 1 ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.min(100, g.progress * 100)}%` }} />
      </div>

      {g.keyResults.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {g.keyResults.map((k) => (
            <li key={k.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-text-muted">{k.title}</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full bg-primary" style={{ width: `${k.progress * 100}%` }} />
              </div>
              <span className="w-16 text-end text-text-subtle">{k.current}/{k.target}</span>
            </li>
          ))}
        </ul>
      )}

      {manage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-28">
            <NumberInput size="sm" value={current === '' ? null : Number(current)} onChange={(v) => setCurrent(v == null ? '' : String(v))} />
          </div>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => onProgress(Number(current) || 0)}>
            {t('strategy.recordProgress')}
          </Button>
          <Select
            value={g.status}
            onChange={(v) => v && onStatus(v)}
            options={(['on_track', 'at_risk', 'off_track', 'achieved', 'missed'] as GoalStatus[]).map((s) => ({
              value: s,
              label: t(`strategy.goalStatus.${s}`),
            }))}
            size="sm"
            className="w-40"
          />
          <Button size="sm" variant="ghost" onClick={() => setKrEdit((v) => !v)}>
            {t('strategy.keyResults')}
          </Button>
        </div>
      )}

      {krEdit && (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-2">
          {krs.map((k, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={k.title}
                placeholder={t('strategy.krTitle')}
                onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
              <Input
                type="number"
                value={String(k.current)}
                className="w-20"
                onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, current: Number(e.target.value) } : x)))}
              />
              <Input
                type="number"
                value={String(k.target)}
                className="w-20"
                onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, target: Number(e.target.value) } : x)))}
              />
              <button onClick={() => setKrs(krs.filter((_, j) => j !== i))} className="px-1 text-text-subtle hover:text-danger">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex justify-between">
            <Button size="sm" variant="ghost" onClick={() => setKrs([...krs, { title: '', current: 0, target: 100 }])}>
              <Plus className="size-3.5" />
              {t('strategy.addKr')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onKrs(krs.filter((k) => k.title.trim()));
                setKrEdit(false);
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
