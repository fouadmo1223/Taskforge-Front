import { useMemo, useRef, useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { Download, FileUp, Plus, ShieldCheck } from 'lucide-react';
import type { ApprovalStrategy } from '@flowdesk/types';
import { APPROVAL_STRATEGIES } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { useMembers } from '@/features/members/members.api';
import { useRealtimeEvent } from '@/lib/realtime/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, MultiSelect, Select, Skeleton, Textarea, toast } from '@/components/ui';
import {
  useCreateDeliverable,
  useDeliverables,
  useRequestVersionApproval,
  useUploadDeliverableVersion,
  type DeliverableView,
} from '@/features/external/external.api';

const STATUS_TONE = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'success',
  delivered: 'primary',
  archived: 'neutral',
} as const;

export function DeliverablesPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const qc = useQueryClient();
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const deliverables = useDeliverables(workspaceId, projectFilter ?? undefined);
  const projects = useProjects(workspaceId);
  const create = useCreateDeliverable(workspaceId);
  const manage = can('project.update');

  useRealtimeEvent('deliverable.updated', () => void qc.invalidateQueries({ queryKey: ['deliverables', workspaceId] }));

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ projectId: null as string | null, title: '', description: '', clientVisible: true });

  const projectOptions = useMemo(
    () => (projects.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` })),
    [projects.data],
  );
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  return (
    <>
      <PageHeader
        title={t('external.deliverables.title')}
        description={t('external.deliverables.description')}
        actions={
          <>
            <Select
              value={projectFilter}
              onChange={setProjectFilter}
              options={projectOptions}
              placeholder={t('nav.projects')}
              clearable
              size="sm"
              className="w-48"
            />
            {manage && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                {t('external.deliverables.newDeliverable')}
              </Button>
            )}
          </>
        }
      />
      <PageBody className="space-y-3">
        {deliverables.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : deliverables.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void deliverables.refetch()} />
        ) : deliverables.data!.length === 0 ? (
          <EmptyState title={t('external.deliverables.empty')} />
        ) : (
          deliverables.data!.map((d) => <DeliverableCard key={d.id} deliverable={d} canManage={manage} />)
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('external.deliverables.newDeliverable')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={create.isPending}
              disabled={!draft.projectId || !draft.title.trim()}
              onClick={() => {
                if (!draft.projectId || !draft.title.trim()) return;
                create.mutate(
                  { projectId: draft.projectId, title: draft.title.trim(), description: draft.description.trim() || undefined, clientVisible: draft.clientVisible },
                  {
                    onSuccess: () => {
                      toast.success(t('external.deliverables.created'));
                      setCreating(false);
                      setDraft({ projectId: null, title: '', description: '', clientVisible: true });
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
          <Field label={t('nav.projects')}>
            <Select value={draft.projectId} onChange={(v) => setDraft({ ...draft, projectId: v })} options={projectOptions} searchable />
          </Field>
          <Field label={t('external.forms.formTitle')}>
            <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label={t('external.forms.formDescription')}>
            <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={draft.clientVisible}
              onChange={(e) => setDraft({ ...draft, clientVisible: e.target.checked })}
              className="size-4 rounded border-border"
            />
            {t('external.deliverables.clientVisible')}
          </label>
        </div>
      </Dialog>
    </>
  );
}

function DeliverableCard({ deliverable: d, canManage }: { deliverable: DeliverableView; canManage: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const members = useMembers(workspaceId);
  const upload = useUploadDeliverableVersion(workspaceId);
  const requestApproval = useRequestVersionApproval(workspaceId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteFor, setNoteFor] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [approvalFor, setApprovalFor] = useState<string | null>(null);
  const [approvers, setApprovers] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<ApprovalStrategy>('parallel_all');

  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };
  const memberOptions = (members.data ?? [])
    .filter((m) => m.user)
    .map((m) => ({ value: m.user!.id, label: m.user!.name }));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-text">{d.title}</span>
        <Badge tone={STATUS_TONE[d.status]}>{t(`external.deliverables.status.${d.status}`)}</Badge>
        {d.clientVisible && <span className="text-[11px] text-text-subtle">{t('external.deliverables.clientVisible')}</span>}
        {canManage && (
          <div className="ms-auto">
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setNoteFor(f);
                  setNote('');
                }
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={upload.isPending}>
              <FileUp className="size-3.5" />
              {t('external.deliverables.uploadVersion')}
            </Button>
          </div>
        )}
      </div>
      {d.description && <p className="mt-1 text-sm text-text-muted">{d.description}</p>}

      {d.versions.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {d.versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-text-subtle">v{v.version}</span>
              {v.note && <span className="text-text-muted">{v.note}</span>}
              <span className="text-xs text-text-subtle">{formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}</span>
              <div className="ms-auto flex items-center gap-1.5">
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary hover:bg-surface-sunken"
                >
                  <Download className="size-3.5" />
                  {t('external.deliverables.download')}
                </a>
                {canManage &&
                  (v.approvalId ? (
                    <span className="inline-flex items-center gap-1 text-xs text-text-subtle">
                      <ShieldCheck className="size-3.5" />
                      {t('external.approvals.title')}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setApprovalFor(v.id);
                        setApprovers([]);
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-text-muted hover:bg-surface-sunken"
                    >
                      {t('external.deliverables.requestApproval')}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={noteFor !== null}
        onOpenChange={(o) => !o && setNoteFor(null)}
        title={t('external.deliverables.newVersion')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={upload.isPending}
              onClick={() => {
                if (!noteFor) return;
                upload.mutate(
                  { id: d.id, file: noteFor, note: note.trim() || undefined },
                  {
                    onSuccess: () => {
                      toast.success(t('external.deliverables.uploaded'));
                      setNoteFor(null);
                    },
                    onError: err,
                  },
                );
              }}
            >
              {t('external.deliverables.uploadVersion')}
            </Button>
          </>
        }
      >
        <p className="mb-2 text-sm text-text-muted">{noteFor?.name}</p>
        <Field label={t('external.deliverables.versionNote')}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Dialog>

      <Dialog
        open={approvalFor !== null}
        onOpenChange={(o) => !o && setApprovalFor(null)}
        title={t('external.deliverables.requestApproval')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApprovalFor(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={approvers.length === 0}
              loading={requestApproval.isPending}
              onClick={() => {
                if (!approvalFor || approvers.length === 0) return;
                requestApproval.mutate(
                  { id: d.id, versionId: approvalFor, approverUserIds: approvers, strategy },
                  {
                    onSuccess: () => {
                      toast.success(t('external.approvals.decided'));
                      setApprovalFor(null);
                    },
                    onError: err,
                  },
                );
              }}
            >
              {t('external.deliverables.requestApproval')}
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
