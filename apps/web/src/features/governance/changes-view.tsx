import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { APPROVAL_STRATEGIES, type ApprovalStrategy, type ChangeRequestStatus } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useMembers } from '@/features/members/members.api';
import { feedback } from '@/lib/api/mutation-feedback';
import { Badge, Button, Dialog, EmptyState, Field, Input, MultiSelect, Select, Skeleton, Textarea } from '@/components/ui';
import {
  useChangeRequests,
  useCreateChangeRequest,
  useRequestCrApproval,
  useTransitionChangeRequest,
  type ChangeRequestView,
} from '@/features/governance/governance.api';

const STATUS_TONE: Record<ChangeRequestStatus, 'neutral' | 'warning' | 'primary' | 'success' | 'danger'> = {
  draft: 'neutral',
  submitted: 'warning',
  in_review: 'primary',
  approved: 'success',
  rejected: 'danger',
  implemented: 'success',
};

const NEXT: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
  draft: ['submitted'],
  submitted: ['in_review', 'draft'],
  in_review: ['approved', 'rejected'],
  approved: ['implemented'],
  rejected: ['draft'],
  implemented: [],
};

export function ChangesView({ projectId }: { projectId: string }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const list = useChangeRequests(workspaceId, projectId);
  const create = useCreateChangeRequest(workspaceId, projectId);
  const transition = useTransitionChangeRequest(workspaceId, projectId);
  const requestApproval = useRequestCrApproval(workspaceId, projectId);
  const members = useMembers(workspaceId);
  const manage = can('change.manage');

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', reason: '', scopeImpact: '', scheduleImpactDays: '', costImpact: '' });
  const [approvalFor, setApprovalFor] = useState<string | null>(null);
  const [approvers, setApprovers] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<ApprovalStrategy>('parallel_all');

  const memberOptions = (members.data ?? []).filter((m) => m.user).map((m) => ({ value: m.user!.id, label: m.user!.name }));

  return (
    <div className="mx-auto max-w-4xl space-y-3 px-6 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('governance.changeRequests')}</h2>
        {manage && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t('governance.newChangeRequest')}
          </Button>
        )}
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState title={t('governance.noChangeRequests')} />
      ) : (
        <div className="space-y-2">
          {list.data!.map((cr) => (
            <CrRow
              key={cr.id}
              cr={cr}
              manage={manage}
              busy={transition.isPending}
              onTransition={(to) => transition.mutate({ id: cr.id, to }, feedback(t, { success: t('common.updated') }))}
              onRequestApproval={() => {
                setApprovalFor(cr.id);
                setApprovers([]);
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('governance.newChangeRequest')}
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
                    reason: draft.reason.trim() || undefined,
                    scopeImpact: draft.scopeImpact.trim() || undefined,
                    scheduleImpactDays: Number(draft.scheduleImpactDays) || 0,
                    costImpact: Number(draft.costImpact) || 0,
                  },
                  {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.created') }).onSuccess();
                      setCreating(false);
                      setDraft({ title: '', reason: '', scopeImpact: '', scheduleImpactDays: '', costImpact: '' });
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
          <Field label={t('governance.crTitle')} className="sm:col-span-2">
            <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label={t('governance.reason')} className="sm:col-span-2">
            <Textarea rows={2} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
          </Field>
          <Field label={t('governance.scopeImpact')} className="sm:col-span-2">
            <Textarea rows={2} value={draft.scopeImpact} onChange={(e) => setDraft({ ...draft, scopeImpact: e.target.value })} />
          </Field>
          <Field label={t('governance.scheduleImpactDays')}>
            <Input type="number" value={draft.scheduleImpactDays} onChange={(e) => setDraft({ ...draft, scheduleImpactDays: e.target.value })} />
          </Field>
          <Field label={t('governance.costImpact')}>
            <Input type="number" value={draft.costImpact} onChange={(e) => setDraft({ ...draft, costImpact: e.target.value })} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={approvalFor !== null}
        onOpenChange={(o) => !o && setApprovalFor(null)}
        title={t('governance.requestApproval')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApprovalFor(null)}>{t('common.cancel')}</Button>
            <Button
              disabled={approvers.length === 0}
              loading={requestApproval.isPending}
              onClick={() => {
                if (!approvalFor || approvers.length === 0) return;
                requestApproval.mutate(
                  { id: approvalFor, approverUserIds: approvers, strategy },
                  {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.updated') }).onSuccess();
                      setApprovalFor(null);
                    },
                  },
                );
              }}
            >
              {t('governance.requestApproval')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('external.approvals.approvers')}>
            <MultiSelect value={approvers} onChange={setApprovers} options={memberOptions} />
          </Field>
          <Field label={t('external.approvals.strategy')}>
            <Select
              value={strategy}
              onChange={(v) => setStrategy(v ?? 'parallel_all')}
              options={APPROVAL_STRATEGIES.map((s) => ({ value: s, label: t(`external.approvals.strategyLabel.${s}`) }))}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

function CrRow({
  cr,
  manage,
  busy,
  onTransition,
  onRequestApproval,
}: {
  cr: ChangeRequestView;
  manage: boolean;
  busy: boolean;
  onTransition: (to: ChangeRequestStatus) => void;
  onRequestApproval: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-text-subtle">{cr.key}</span>
        <Badge tone={STATUS_TONE[cr.status]}>{t(`governance.crStatus.${cr.status}`)}</Badge>
        <span className="font-medium text-text">{cr.title}</span>
        <span className="ms-auto text-xs text-text-subtle">{format(new Date(cr.createdAt), 'MMM d, yyyy')}</span>
      </div>
      {cr.reason && <p className="mt-1 text-sm text-text-muted">{cr.reason}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-subtle">
        {cr.scopeImpact && <span>{t('governance.scopeImpact')}: {cr.scopeImpact}</span>}
        {cr.scheduleImpactDays !== 0 && <span>{t('governance.scheduleImpactDays')}: {cr.scheduleImpactDays}d</span>}
        {cr.costImpact !== 0 && <span>{t('governance.costImpact')}: {cr.costImpact}</span>}
      </div>
      {manage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!cr.approvalId && (cr.status === 'draft' || cr.status === 'submitted') && (
            <Button size="sm" variant="secondary" onClick={onRequestApproval}>
              {t('governance.requestApproval')}
            </Button>
          )}
          {NEXT[cr.status].map((to) => (
            <Button key={to} size="sm" variant="ghost" disabled={busy} onClick={() => onTransition(to)}>
              → {t(`governance.crStatus.${to}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
