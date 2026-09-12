import { useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { RISK_SCALE, RISK_STATUSES, ISSUE_STATUSES, DECISION_STATUSES, SEVERITIES } from '@flowdesk/types';
import type { RiskScale, Severity } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { Badge, Button, EmptyState, Input, Select, Skeleton, Textarea, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  useRaid,
  useCreateRisk,
  useUpdateRisk,
  useDeleteRisk,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  useCreateDecision,
  useUpdateDecision,
  useDeleteDecision,
  type DecisionView,
  type IssueView,
  type RiskView,
} from '@/features/governance/governance.api';

const SEV_TONE: Record<Severity, 'neutral' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

export function RaidView({ projectId }: { projectId: string }): React.ReactElement {
  const { workspaceId, canAny } = useWorkspace();
  const raid = useRaid(workspaceId, projectId);
  const canEdit = canAny('risk.manage', 'issue.manage', 'decision.manage');

  if (raid.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-6 py-6 lg:grid-cols-3">
      <RiskColumn projectId={projectId} risks={raid.data?.risks ?? []} canEdit={canEdit} />
      <IssueColumn projectId={projectId} issues={raid.data?.issues ?? []} canEdit={canEdit} />
      <DecisionColumn projectId={projectId} decisions={raid.data?.decisions ?? []} canEdit={canEdit} />
    </div>
  );
}

function Column({ title, count, children, onAdd, canEdit }: { title: string; count: number; children: React.ReactNode; onAdd: () => void; canEdit: boolean }): React.ReactElement {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {title} <span className="text-text-subtle">{count}</span>
        </h2>
        {canEdit && (
          <button onClick={onAdd} className="rounded-lg p-1 text-text-muted hover:bg-surface-sunken">
            <Plus className="size-4" />
          </button>
        )}
      </header>
      <div className="flex-1 space-y-2 p-2">{children}</div>
    </section>
  );
}

const scaleOpts = RISK_SCALE.map((s) => ({ value: s, label: s.replace('_', ' ') }));

function RiskColumn({ projectId, risks, canEdit }: { projectId: string; risks: RiskView[]; canEdit: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const create = useCreateRisk(workspaceId, projectId);
  const update = useUpdateRisk(workspaceId, projectId);
  const del = useDeleteRisk(workspaceId, projectId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', probability: 'medium' as RiskScale, impact: 'medium' as RiskScale, mitigation: '' });
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  return (
    <Column title={t('governance.risks')} count={risks.length} onAdd={() => setAdding(true)} canEdit={canEdit}>
      {adding && (
        <div className="space-y-2 rounded-lg border border-border p-2">
          <Input autoFocus placeholder={t('governance.riskTitle')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={draft.probability} onChange={(v) => setDraft({ ...draft, probability: v ?? 'medium' })} options={scaleOpts} size="sm" />
            <Select value={draft.impact} onChange={(v) => setDraft({ ...draft, impact: v ?? 'medium' })} options={scaleOpts} size="sm" />
          </div>
          <Textarea rows={2} placeholder={t('governance.mitigation')} value={draft.mitigation} onChange={(e) => setDraft({ ...draft, mitigation: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button
              size="sm"
              loading={create.isPending}
              disabled={!draft.title.trim()}
              onClick={() =>
                create.mutate(draft, {
                  onSuccess: () => {
                    setAdding(false);
                    setDraft({ title: '', probability: 'medium', impact: 'medium', mitigation: '' });
                  },
                  onError: err,
                })
              }
            >
              {t('common.create')}
            </Button>
          </div>
        </div>
      )}
      {risks.length === 0 && !adding ? (
        <EmptyState title={t('governance.noRisks')} className="py-6" />
      ) : (
        risks.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-2.5">
            <div className="flex items-start gap-2">
              <Badge tone={SEV_TONE[r.severity]}>{t(`governance.severity.${r.severity}`)}</Badge>
              <span className="flex-1 text-sm font-medium text-text">{r.title}</span>
              {canEdit && (
                <button onClick={() => del.mutate(r.id, { onError: err })} className="text-text-subtle hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            {r.mitigation && <p className="mt-1 text-xs text-text-muted">{r.mitigation}</p>}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[11px] text-text-subtle">
                P: {r.probability.replace('_', ' ')} · I: {r.impact.replace('_', ' ')}
              </span>
              {canEdit ? (
                <Select
                  value={r.status}
                  onChange={(v) => v && update.mutate({ id: r.id, status: v }, { onError: err })}
                  options={RISK_STATUSES.map((s) => ({ value: s, label: s }))}
                  size="sm"
                  className="ms-auto w-32"
                />
              ) : (
                <span className="ms-auto text-[11px] text-text-subtle">{r.status}</span>
              )}
            </div>
          </div>
        ))
      )}
    </Column>
  );
}

function IssueColumn({ projectId, issues, canEdit }: { projectId: string; issues: IssueView[]; canEdit: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const create = useCreateIssue(workspaceId, projectId);
  const update = useUpdateIssue(workspaceId, projectId);
  const del = useDeleteIssue(workspaceId, projectId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', severity: 'medium' as Severity });
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  return (
    <Column title={t('governance.issues')} count={issues.length} onAdd={() => setAdding(true)} canEdit={canEdit}>
      {adding && (
        <div className="space-y-2 rounded-lg border border-border p-2">
          <Input autoFocus placeholder={t('governance.issueTitle')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Select value={draft.severity} onChange={(v) => setDraft({ ...draft, severity: v ?? 'medium' })} options={SEVERITIES.map((s) => ({ value: s, label: s }))} size="sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button
              size="sm"
              loading={create.isPending}
              disabled={!draft.title.trim()}
              onClick={() =>
                create.mutate(draft, {
                  onSuccess: () => {
                    setAdding(false);
                    setDraft({ title: '', severity: 'medium' });
                  },
                  onError: err,
                })
              }
            >
              {t('common.create')}
            </Button>
          </div>
        </div>
      )}
      {issues.length === 0 && !adding ? (
        <EmptyState title={t('governance.noIssues')} className="py-6" />
      ) : (
        issues.map((i) => (
          <div key={i.id} className="rounded-lg border border-border p-2.5">
            <div className="flex items-start gap-2">
              <Badge tone={SEV_TONE[i.severity]}>{t(`governance.severity.${i.severity}`)}</Badge>
              <span className="flex-1 text-sm font-medium text-text">{i.title}</span>
              {canEdit && (
                <button onClick={() => del.mutate(i.id, { onError: err })} className="text-text-subtle hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1.5">
              {canEdit ? (
                <Select
                  value={i.status}
                  onChange={(v) => v && update.mutate({ id: i.id, status: v }, { onError: err })}
                  options={ISSUE_STATUSES.map((s) => ({ value: s, label: s }))}
                  size="sm"
                  className="w-36"
                />
              ) : (
                <span className="text-[11px] text-text-subtle">{i.status}</span>
              )}
            </div>
          </div>
        ))
      )}
    </Column>
  );
}

function DecisionColumn({ projectId, decisions, canEdit }: { projectId: string; decisions: DecisionView[]; canEdit: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const create = useCreateDecision(workspaceId, projectId);
  const update = useUpdateDecision(workspaceId, projectId);
  const del = useDeleteDecision(workspaceId, projectId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', context: '', decision: '' });
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  return (
    <Column title={t('governance.decisions')} count={decisions.length} onAdd={() => setAdding(true)} canEdit={canEdit}>
      {adding && (
        <div className="space-y-2 rounded-lg border border-border p-2">
          <Input autoFocus placeholder={t('governance.decisionTitle')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Textarea rows={2} placeholder={t('governance.context')} value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })} />
          <Textarea rows={2} placeholder={t('governance.decisionText')} value={draft.decision} onChange={(e) => setDraft({ ...draft, decision: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button
              size="sm"
              loading={create.isPending}
              disabled={!draft.title.trim()}
              onClick={() =>
                create.mutate(draft, {
                  onSuccess: () => {
                    setAdding(false);
                    setDraft({ title: '', context: '', decision: '' });
                  },
                  onError: err,
                })
              }
            >
              {t('common.create')}
            </Button>
          </div>
        </div>
      )}
      {decisions.length === 0 && !adding ? (
        <EmptyState title={t('governance.noDecisions')} className="py-6" />
      ) : (
        decisions.map((d) => (
          <div key={d.id} className={cn('rounded-lg border border-border p-2.5', d.status === 'superseded' && 'opacity-60')}>
            <div className="flex items-start gap-2">
              <span className="flex-1 text-sm font-medium text-text">{d.title}</span>
              {canEdit && (
                <button onClick={() => del.mutate(d.id, { onError: err })} className="text-text-subtle hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            {d.decision && <p className="mt-1 text-xs text-text-muted">{d.decision}</p>}
            <div className="mt-1.5">
              {canEdit ? (
                <Select
                  value={d.status}
                  onChange={(v) => v && update.mutate({ id: d.id, status: v }, { onError: err })}
                  options={DECISION_STATUSES.map((s) => ({ value: s, label: s }))}
                  size="sm"
                  className="w-36"
                />
              ) : (
                <span className="text-[11px] text-text-subtle">{d.status}</span>
              )}
            </div>
          </div>
        ))
      )}
    </Column>
  );
}
