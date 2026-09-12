import { useMemo, useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { Check, Plus, X } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { useRealtimeEvent } from '@/lib/realtime/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Textarea, toast } from '@/components/ui';
import { PrioritySelect } from '@/components/ui/select/specialized';
import type { TaskPriority } from '@flowdesk/types';
import {
  useConvertRequest,
  useCreateRequest,
  useRequests,
  useUpdateRequest,
  type RequestStatus,
  type RequestView,
} from '@/features/external/external.api';

const STATUS_TONE: Record<RequestStatus, 'neutral' | 'primary' | 'warning' | 'success' | 'danger'> = {
  new: 'primary',
  triage: 'warning',
  accepted: 'success',
  declined: 'danger',
  converted: 'neutral',
};

export function RequestsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<RequestStatus | ''>('');
  const requests = useRequests(workspaceId, filter || undefined);
  const projects = useProjects(workspaceId);
  const create = useCreateRequest(workspaceId);
  const update = useUpdateRequest(workspaceId);
  const convert = useConvertRequest(workspaceId);
  const manage = can('request.manage');

  useRealtimeEvent('request.created', () => void qc.invalidateQueries({ queryKey: ['requests', workspaceId] }));
  useRealtimeEvent('request.updated', () => void qc.invalidateQueries({ queryKey: ['requests', workspaceId] }));

  const [creating, setCreating] = useState(false);
  const [newReq, setNewReq] = useState({ title: '', description: '', priority: 'medium' as TaskPriority });
  const [convertFor, setConvertFor] = useState<RequestView | null>(null);
  const [convertProject, setConvertProject] = useState<string | null>(null);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('common.all' as never, { defaultValue: 'All' }) },
      ...(['new', 'triage', 'accepted', 'declined', 'converted'] as RequestStatus[]).map((s) => ({
        value: s,
        label: t(`external.requests.status.${s}`),
      })),
    ],
    [t],
  );

  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  return (
    <>
      <PageHeader
        title={t('external.requests.title')}
        description={t('external.requests.description')}
        actions={
          <>
            <Select
              value={filter}
              onChange={(v) => setFilter((v ?? '') as RequestStatus | '')}
              options={statusOptions}
              size="sm"
              className="w-40"
            />
            {manage && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                {t('external.requests.newRequest')}
              </Button>
            )}
          </>
        }
      />
      <PageBody className="space-y-2">
        {requests.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : requests.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void requests.refetch()} />
        ) : requests.data!.length === 0 ? (
          <EmptyState title={t('external.requests.empty')} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {requests.data!.map((r) => (
              <div key={r.id} className="bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone={STATUS_TONE[r.status]}>{t(`external.requests.status.${r.status}`)}</Badge>
                  <span className="text-[11px] uppercase tracking-wide text-text-subtle">{t(`external.requests.source.${r.source}`)}</span>
                  <span className="font-medium text-text">{r.title}</span>
                  <span className="text-xs text-text-subtle">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                  {manage && r.status !== 'converted' && (
                    <div className="ms-auto flex items-center gap-1.5">
                      {r.status !== 'accepted' && (
                        <Button size="sm" variant="secondary" onClick={() => update.mutate({ id: r.id, status: 'accepted' }, { onError: err })}>
                          <Check className="size-3.5" />
                          {t('external.requests.accept')}
                        </Button>
                      )}
                      {r.status !== 'declined' && (
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => update.mutate({ id: r.id, status: 'declined' }, { onError: err })}>
                          <X className="size-3.5" />
                          {t('external.requests.decline')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConvertFor(r);
                          setConvertProject(r.projectId ?? null);
                        }}
                      >
                        {t('external.requests.convert')}
                      </Button>
                    </div>
                  )}
                  {r.linkedTaskId && <span className="ms-auto text-xs text-text-subtle">→ {t('external.requests.status.converted')}</span>}
                </div>
                {r.description && <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{r.description}</p>}
                {(r.requesterName || r.requesterEmail) && (
                  <p className="mt-1 text-xs text-text-subtle">
                    {t('external.requests.requester')}: {r.requesterName} {r.requesterEmail && `· ${r.requesterEmail}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('external.requests.newRequest')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={create.isPending}
              onClick={() => {
                if (!newReq.title.trim()) return;
                create.mutate(
                  { title: newReq.title.trim(), description: newReq.description.trim() || undefined, priority: newReq.priority },
                  {
                    onSuccess: () => {
                      setCreating(false);
                      setNewReq({ title: '', description: '', priority: 'medium' });
                    },
                    onError: err,
                  },
                );
              }}
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('external.requests.newRequest')}>
            <Input autoFocus value={newReq.title} onChange={(e) => setNewReq({ ...newReq, title: e.target.value })} />
          </Field>
          <Field label={t('portal.requestDetails')}>
            <Textarea rows={3} value={newReq.description} onChange={(e) => setNewReq({ ...newReq, description: e.target.value })} />
          </Field>
          <Field label={t('external.approvals.strategy' as never, { defaultValue: 'Priority' })}>
            <PrioritySelect value={newReq.priority} onChange={(v) => setNewReq({ ...newReq, priority: v ?? 'medium' })} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={convertFor !== null}
        onOpenChange={(o) => !o && setConvertFor(null)}
        title={t('external.requests.convert')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConvertFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!convertProject}
              loading={convert.isPending}
              onClick={() => {
                if (!convertFor || !convertProject) return;
                convert.mutate(
                  { id: convertFor.id, projectId: convertProject },
                  {
                    onSuccess: (res) => {
                      toast.success(t('external.requests.converted', { key: res.taskKey }));
                      setConvertFor(null);
                    },
                    onError: err,
                  },
                );
              }}
            >
              {t('external.requests.convert')}
            </Button>
          </>
        }
      >
        <Field label={t('external.requests.convertToProject')}>
          <Select
            value={convertProject}
            onChange={setConvertProject}
            options={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
            searchable
          />
        </Field>
      </Dialog>
    </>
  );
}
