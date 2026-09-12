import { useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { Check, MessageSquare, X } from 'lucide-react';
import type { ApprovalDecision } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useAuth } from '@/features/auth/auth.store';
import { useMembers } from '@/features/members/members.api';
import { useRealtimeEvent } from '@/lib/realtime/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Avatar, Badge, Button, EmptyState, ErrorState, Skeleton, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useDecideApproval, useMyApprovals, type ApprovalView } from '@/features/external/external.api';

export function ApprovalsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const myUserId = useAuth((s) => s.user?.id ?? '');
  const qc = useQueryClient();
  const enabled = can('approval.approve');
  const approvals = useMyApprovals(workspaceId, enabled);
  const members = useMembers(workspaceId);
  const decide = useDecideApproval(workspaceId);

  useRealtimeEvent('approval.updated', () => void qc.invalidateQueries({ queryKey: ['approvals', workspaceId] }));

  const nameOf = (userId: string): string =>
    members.data?.find((m) => m.user?.id === userId)?.user?.name ?? '—';
  const avatarOf = (userId: string): string | null =>
    members.data?.find((m) => m.user?.id === userId)?.user?.name ? null : null;

  if (!enabled) {
    return (
      <>
        <PageHeader title={t('external.approvals.title')} />
        <PageBody>
          <EmptyState title={t('external.approvals.empty')} />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('external.approvals.title')} description={t('external.approvals.description')} />
      <PageBody className="space-y-3">
        {approvals.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : approvals.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void approvals.refetch()} />
        ) : approvals.data!.length === 0 ? (
          <EmptyState title={t('external.approvals.empty')} />
        ) : (
          approvals.data!.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              myUserId={myUserId}
              nameOf={nameOf}
              avatarOf={avatarOf}
              busy={decide.isPending}
              onDecide={(stepId, decision, comment) =>
                decide.mutate(
                  { approvalId: a.id, stepId, decision, comment },
                  {
                    onSuccess: () => toast.success(t('external.approvals.decided')),
                    onError: (e) => toast.error(errorText(e, t)),
                  },
                )
              }
            />
          ))
        )}
      </PageBody>
    </>
  );
}

function ApprovalCard({
  approval,
  myUserId,
  nameOf,
  avatarOf,
  busy,
  onDecide,
}: {
  approval: ApprovalView;
  myUserId: string;
  nameOf: (id: string) => string;
  avatarOf: (id: string) => string | null;
  busy: boolean;
  onDecide: (stepId: string, decision: ApprovalDecision, comment?: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const myStep = approval.steps.find((s) => s.approverUserId === myUserId && s.actionable && !s.decision);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text">{approval.title}</span>
        <Badge tone="neutral">{t(`external.approvals.strategyLabel.${approval.strategy}`)}</Badge>
        <span className="text-xs text-text-subtle">{formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}</span>
      </div>
      {approval.description && <p className="mt-1 text-sm text-text-muted">{approval.description}</p>}

      <ol className="mt-3 space-y-1.5">
        {approval.steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                s.decision === 'approved'
                  ? 'bg-success-soft text-success'
                  : s.decision === 'rejected' || s.decision === 'changes_requested'
                    ? 'bg-danger-soft text-danger'
                    : s.actionable
                      ? 'bg-warning-soft text-warning'
                      : 'bg-surface-sunken text-text-subtle',
              )}
            >
              {s.order + 1}
            </span>
            <Avatar name={nameOf(s.approverUserId)} src={avatarOf(s.approverUserId)} size="xs" />
            <span className="text-text">{nameOf(s.approverUserId)}</span>
            {s.decision && (
              <span className={cn('text-xs', s.decision === 'approved' ? 'text-success' : 'text-danger')}>
                {t(`external.approvals.${s.decision === 'approved' ? 'approve' : s.decision === 'rejected' ? 'reject' : 'requestChanges'}` as never)}
              </span>
            )}
            {s.comment && <span className="text-xs text-text-subtle">“{s.comment}”</span>}
          </li>
        ))}
      </ol>

      {myStep ? (
        <div className="mt-3 space-y-2">
          {showComment && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('external.approvals.comment')}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} onClick={() => onDecide(myStep.id, 'approved', comment || undefined)}>
              <Check className="size-3.5" />
              {t('external.approvals.approve')}
            </Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => onDecide(myStep.id, 'rejected', comment || undefined)}>
              <X className="size-3.5" />
              {t('external.approvals.reject')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDecide(myStep.id, 'changes_requested', comment || undefined)}>
              {t('external.approvals.requestChanges')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowComment((v) => !v)}>
              <MessageSquare className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-text-subtle">{t('external.approvals.awaitingOthers')}</p>
      )}
    </div>
  );
}
