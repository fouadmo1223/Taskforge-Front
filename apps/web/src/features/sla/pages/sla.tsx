import { useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { TASK_PRIORITIES, type SlaState, type TaskPriority } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { useMembers } from '@/features/members/members.api';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, MultiSelect, Skeleton, toast } from '@/components/ui';
import {
  useCreateSlaPolicy,
  useDeleteSlaPolicy,
  useSlaPolicies,
  useSlaSweep,
  useSlaTrackers,
  useUpdateSlaPolicy,
  type SlaPolicyView,
} from '@/features/sla/sla.api';

const STATE_TONE: Record<SlaState, 'neutral' | 'warning' | 'danger' | 'success' | 'primary'> = {
  ok: 'success',
  warning: 'warning',
  breached: 'danger',
  paused: 'neutral',
  met: 'primary',
};

export function SlaPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const policies = useSlaPolicies(workspaceId);
  const trackers = useSlaTrackers(workspaceId);
  const projects = useProjects(workspaceId);
  const members = useMembers(workspaceId);
  const create = useCreateSlaPolicy(workspaceId);
  const update = useUpdateSlaPolicy(workspaceId);
  const del = useDeleteSlaPolicy(workspaceId);
  const sweep = useSlaSweep(workspaceId);
  const manage = can('sla.manage');

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    responseHours: '4',
    resolutionHours: '24',
    warnAtPercent: '80',
    projectIds: [] as string[],
    priorities: [] as TaskPriority[],
    notifyUserIds: [] as string[],
    escalateToUserIds: [] as string[],
  });
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }));
  const memberOptions = (members.data ?? []).filter((m) => m.user).map((m) => ({ value: m.user!.id, label: m.user!.name }));
  const projName = (id: string): string => projects.data?.find((p) => p.id === id)?.key ?? '—';

  return (
    <>
      <PageHeader
        title={t('sla.title')}
        description={t('sla.description')}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={sweep.isPending}
              onClick={() =>
                sweep.mutate(undefined, {
                  onSuccess: (r) => toast.success(t('sla.sweepResult', { warned: r.warned, breached: r.breached })),
                  onError: err,
                })
              }
            >
              <RefreshCw className="size-3.5" />
              {t('sla.runSweep')}
            </Button>
            {manage && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                {t('sla.newPolicy')}
              </Button>
            )}
          </>
        }
      />
      <PageBody className="space-y-8">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('sla.policies')}</h2>
          {policies.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : policies.isError ? (
            <ErrorState title={t('errors.generic')} onRetry={() => void policies.refetch()} />
          ) : policies.data!.length === 0 ? (
            <EmptyState title={t('sla.noPolicies')} />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {policies.data!.map((p) => (
                <PolicyRow
                  key={p.id}
                  policy={p}
                  manage={manage}
                  projName={projName}
                  onToggle={() => update.mutate({ id: p.id, active: !p.active }, { onError: err })}
                  onDelete={() => del.mutate(p.id, { onError: err })}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('sla.trackers')}</h2>
          {trackers.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (trackers.data?.length ?? 0) === 0 ? (
            <EmptyState icon={<RefreshCw className="size-5" />} title={t('sla.noTrackers')} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken text-xs uppercase tracking-wide text-text-subtle">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">{t('sla.task')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('sla.policy')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('sla.state')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('sla.resolutionDue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trackers.data!.map((tr) => (
                    <tr key={tr.id} className="bg-surface transition-colors hover:bg-surface-sunken/60">
                      <td className="px-4 py-2.5">
                        <span className="me-1.5 font-mono text-[11px] text-text-subtle">{tr.taskKey}</span>
                        {tr.taskTitle}
                      </td>
                      <td className="px-4 py-2.5 text-text-muted">{tr.policyName}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATE_TONE[tr.state]}>{t(`sla.stateLabel.${tr.state}`)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-subtle">
                        {tr.resolvedAt ? t('sla.resolved') : formatDistanceToNow(new Date(tr.resolutionDueAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('sla.newPolicy')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!draft.name.trim()}
              onClick={() =>
                create.mutate(
                  {
                    name: draft.name.trim(),
                    responseHours: Number(draft.responseHours) || 0,
                    resolutionHours: Number(draft.resolutionHours) || 0,
                    warnAtPercent: Number(draft.warnAtPercent) || 80,
                    appliesTo: { projectIds: draft.projectIds, priorities: draft.priorities },
                    notifyUserIds: draft.notifyUserIds,
                    escalateToUserIds: draft.escalateToUserIds,
                  },
                  { onSuccess: () => setCreating(false), onError: err },
                )
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-3">
          <Field label={t('sla.policyName')} className="sm:col-span-3">
            <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={t('sla.responseHours')}>
            <Input type="number" value={draft.responseHours} onChange={(e) => setDraft({ ...draft, responseHours: e.target.value })} />
          </Field>
          <Field label={t('sla.resolutionHours')}>
            <Input type="number" value={draft.resolutionHours} onChange={(e) => setDraft({ ...draft, resolutionHours: e.target.value })} />
          </Field>
          <Field label={t('sla.warnAtPercent')}>
            <Input type="number" value={draft.warnAtPercent} onChange={(e) => setDraft({ ...draft, warnAtPercent: e.target.value })} />
          </Field>
          <Field label={t('sla.appliesToProjects')} className="sm:col-span-3">
            <MultiSelect value={draft.projectIds} onChange={(v) => setDraft({ ...draft, projectIds: v })} options={projectOptions} placeholder={t('sla.anyProject')} />
          </Field>
          <Field label={t('sla.appliesToPriorities')} className="sm:col-span-3">
            <MultiSelect
              value={draft.priorities}
              onChange={(v) => setDraft({ ...draft, priorities: v })}
              options={TASK_PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) }))}
              placeholder={t('sla.anyPriority')}
            />
          </Field>
          <Field label={t('sla.notifyOnWarning')} className="sm:col-span-3">
            <MultiSelect value={draft.notifyUserIds} onChange={(v) => setDraft({ ...draft, notifyUserIds: v })} options={memberOptions} />
          </Field>
          <Field label={t('sla.escalateOnBreach')} className="sm:col-span-3">
            <MultiSelect value={draft.escalateToUserIds} onChange={(v) => setDraft({ ...draft, escalateToUserIds: v })} options={memberOptions} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

function PolicyRow({
  policy,
  manage,
  projName,
  onToggle,
  onDelete,
}: {
  policy: SlaPolicyView;
  manage: boolean;
  projName: (id: string) => string;
  onToggle: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-3">
      {!policy.active && <Badge tone="neutral">{t('sla.inactive')}</Badge>}
      <span className="font-medium text-text">{policy.name}</span>
      <span className="text-xs text-text-subtle">
        {t('sla.responseHours')} {policy.responseHours}h · {t('sla.resolutionHours')} {policy.resolutionHours}h · {policy.warnAtPercent}%
      </span>
      {policy.appliesTo.projectIds.length > 0 && (
        <span className="text-xs text-text-subtle">{policy.appliesTo.projectIds.map(projName).join(', ')}</span>
      )}
      {policy.appliesTo.priorities.length > 0 && (
        <span className="text-xs text-text-subtle">{policy.appliesTo.priorities.map((p) => t(`priority.${p}`)).join(', ')}</span>
      )}
      {manage && (
        <div className="ms-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onToggle}>
            {policy.active ? t('sla.deactivate') : t('sla.activate')}
          </Button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
