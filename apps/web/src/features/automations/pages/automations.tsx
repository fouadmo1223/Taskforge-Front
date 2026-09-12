import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, type AutomationTrigger } from '@flowdesk/types';
import { Plus, Play, Trash2, Zap } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { errorText } from '@/lib/api/errors';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, toast } from '@/components/ui';
import {
  useAutomationRuns,
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useRunAutomations,
  useTestAutomation,
  useUpdateAutomation,
  type AutomationView,
} from '@/features/automations/automations.api';

const CONDITION_FIELDS = ['priority', 'statusCategory', 'title', 'assigneeCount', 'labelCount', 'dueInDays'];
const OPS = ['eq', 'neq', 'contains', 'gt', 'lt', 'is_empty', 'is_set'];

export function AutomationsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const automations = useAutomations(workspaceId);
  const create = useCreateAutomation(workspaceId);
  const update = useUpdateAutomation(workspaceId);
  const del = useDeleteAutomation(workspaceId);
  const run = useRunAutomations(workspaceId);
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title={t('automations.title')}
        description={t('automations.description')}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={run.isPending}
              title={t('automations.runNowHint')}
              onClick={() =>
                run.mutate(undefined, {
                  onSuccess: (r) => toast.success(t('automations.ranResult', { executed: r.executed })),
                  onError: err,
                })
              }
            >
              <Play className="size-3.5" />
              {t('automations.runNow')}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('automations.newAutomation')}
            </Button>
          </>
        }
      />
      <PageBody className="space-y-3">
        {automations.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : automations.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void automations.refetch()} />
        ) : automations.data!.length === 0 ? (
          <EmptyState title={t('automations.empty')} icon={<Zap className="size-5" />} />
        ) : (
          automations.data!.map((a) => (
            <AutomationRow
              key={a.id}
              automation={a}
              onToggle={() => update.mutate({ id: a.id, active: !a.active }, { onError: err })}
              onDelete={() => del.mutate(a.id, { onError: err })}
            />
          ))
        )}
      </PageBody>

      {creating && (
        <AutomationBuilder
          onClose={() => setCreating(false)}
          onSubmit={(body) =>
            create.mutate(body, {
              onSuccess: () => {
                toast.success(t('automations.created'));
                setCreating(false);
              },
              onError: err,
            })
          }
          saving={create.isPending}
        />
      )}
    </>
  );
}

function AutomationRow({
  automation: a,
  onToggle,
  onDelete,
}: {
  automation: AutomationView;
  onToggle: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const [showRuns, setShowRuns] = useState(false);
  const runs = useAutomationRuns(workspaceId, showRuns ? a.id : null);
  const test = useTestAutomation(workspaceId);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!a.active && <Badge tone="neutral">{t('sla.inactive')}</Badge>}
        <span className="font-medium text-text">{a.name}</span>
        <Badge tone="primary">{t(`automations.triggerLabel.${a.trigger.type}`, { defaultValue: a.trigger.type })}</Badge>
        <span className="text-xs text-text-subtle">
          {a.actions.map((x) => t(`automations.actionLabel.${x.type}`, { defaultValue: x.type })).join(' → ')}
        </span>
        <span className="text-xs text-text-subtle">{t('automations.runs', { count: a.runCount })}</span>
        <div className="ms-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            loading={test.isPending}
            title={t('automations.testHint')}
            onClick={() =>
              test.mutate(a.id, {
                onSuccess: (r) => {
                  if (r.status === 'skipped') toast.error(t('automations.testSkipped'));
                  else if (r.status === 'failed') toast.error(r.error || t('errors.generic'));
                  else toast.success(t('automations.testRan', { actions: r.actionsRun.length }));
                },
                onError: (e) => toast.error(errorText(e, t)),
              })
            }
          >
            {t('automations.test')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowRuns((v) => !v)}>{t('automations.history')}</Button>
          <Button size="sm" variant="ghost" onClick={onToggle}>{a.active ? t('sla.deactivate') : t('sla.activate')}</Button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-danger">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {a.lastError && <p className="mt-1 text-xs text-danger">{a.lastError}</p>}
      {showRuns && (
        <div className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
          {(runs.data ?? []).length === 0 ? (
            <p className="text-text-subtle">{t('automations.noRuns')}</p>
          ) : (
            runs.data!.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Badge tone={r.status === 'success' ? 'success' : r.status === 'skipped' ? 'neutral' : 'danger'}>{r.status}</Badge>
                <span className="text-text-muted">{r.trigger}</span>
                <span className="text-text-subtle">{r.actionsRun.join(', ')}</span>
                <span className="ms-auto text-text-subtle">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AutomationBuilder({
  onClose,
  onSubmit,
  saving,
}: {
  onClose: () => void;
  onSubmit: (body: {
    name: string;
    trigger: { type: AutomationTrigger; config?: Record<string, unknown> };
    conditions?: { field: string; op: string; value?: unknown }[];
    actions: { type: string; config?: Record<string, unknown> }[];
  }) => void;
  saving: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<AutomationTrigger>('task.due_soon');
  const [cond, setCond] = useState({ field: 'priority', op: 'eq', value: '' });
  const [actions, setActions] = useState<{ type: string; config: Record<string, string> }[]>([
    { type: 'send_notification', config: {} },
  ]);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('automations.newAutomation')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            loading={saving}
            disabled={!name.trim() || actions.length === 0}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                trigger: { type: trigger },
                conditions: cond.value.trim() || ['is_empty', 'is_set'].includes(cond.op) ? [{ ...cond, value: cond.value.trim() || undefined }] : [],
                actions: actions.map((a) => ({ type: a.type, config: a.config })),
              })
            }
          >
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        <Field label={t('automations.name')}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('automations.trigger')}>
          <Select
            value={trigger}
            onChange={(v) => setTrigger(v ?? 'task.due_soon')}
            options={AUTOMATION_TRIGGERS.map((x) => ({ value: x, label: t(`automations.triggerLabel.${x}`, { defaultValue: x }) }))}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">{t('automations.condition')}</p>
          <div className="flex gap-2">
            <Select value={cond.field} onChange={(v) => setCond({ ...cond, field: v ?? 'priority' })} options={CONDITION_FIELDS.map((f) => ({ value: f, label: f }))} size="sm" />
            <Select value={cond.op} onChange={(v) => setCond({ ...cond, op: v ?? 'eq' })} options={OPS.map((o) => ({ value: o, label: o }))} size="sm" />
            <Input value={cond.value} onChange={(e) => setCond({ ...cond, value: e.target.value })} placeholder={t('automations.value')} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">{t('automations.actions')}</p>
          <div className="space-y-2">
            {actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <Select
                  value={a.type}
                  onChange={(v) => setActions(actions.map((x, j) => (j === i ? { ...x, type: v ?? 'send_notification' } : x)))}
                  options={AUTOMATION_ACTIONS.map((x) => ({ value: x, label: t(`automations.actionLabel.${x}`, { defaultValue: x }) }))}
                  size="sm"
                  className="w-48 shrink-0"
                />
                <Input
                  value={a.config.body ?? a.config.title ?? ''}
                  onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, config: { ...x.config, body: e.target.value, title: e.target.value } } : x)))}
                  placeholder={t('automations.actionConfig')}
                />
                <button onClick={() => setActions(actions.filter((_, j) => j !== i))} className="px-1 pt-2 text-text-subtle hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setActions([...actions, { type: 'add_comment', config: {} }])}>
              <Plus className="size-3.5" />
              {t('automations.addAction')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
