import { useMemo, useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { Navigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, CheckCircle2, Download, FileText, Plus } from 'lucide-react';
import type { ApprovalDecision } from '@flowdesk/types';
import { useAuth } from '@/features/auth/auth.store';
import { FullPageSpinner } from '@/components/layout/full-page-spinner';
import { UserMenu } from '@/components/layout/user-menu';
import { LanguageThemeControls } from '@/components/layout/language-theme-controls';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Scrollable, Skeleton, Textarea, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useDecideApproval, type DeliverableView } from '@/features/external/external.api';
import {
  useCreatePortalRequest,
  usePortalApprovals,
  usePortalDeliverables,
  usePortalOverview,
  usePortalProject,
  usePortalRequests,
} from '@/features/portal/portal.api';

type Tab = 'overview' | 'deliverables' | 'approvals' | 'requests';

export function PortalShell(): React.ReactElement {
  const { workspaceSlug } = useParams();
  const status = useAuth((s) => s.status);
  const memberships = useAuth((s) => s.memberships);

  const membership = useMemo(
    () => memberships.find((m) => m.workspaceSlug === workspaceSlug && m.isClient),
    [memberships, workspaceSlug],
  );

  if (status === 'loading') return <FullPageSpinner />;
  if (!membership) return <Navigate to="/" replace />;

  return <PortalInner workspaceId={membership.workspaceId} workspaceName={membership.workspaceName} />;
}

function PortalInner({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const [openProject, setOpenProject] = useState<string | null>(null);
  const overview = usePortalOverview(workspaceId);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('portal.overview') },
    { key: 'deliverables', label: t('portal.deliverables') },
    { key: 'approvals', label: t('portal.approvals') },
    { key: 'requests', label: t('portal.requests') },
  ];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
        <FileText className="size-5 text-primary" />
        <div className="font-semibold text-text">{workspaceName}</div>
        <Badge tone="neutral">{t('portal.title')}</Badge>
        <div className="flex-1" />
        <LanguageThemeControls compact />
        <UserMenu />
      </header>

      <nav className="flex shrink-0 gap-1 border-b border-border bg-surface px-4">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => {
              setTab(tb.key);
              setOpenProject(null);
            }}
            className={cn(
              'border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              tab === tb.key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {tb.label}
          </button>
        ))}
      </nav>

      <Scrollable className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {tab === 'overview' &&
            (openProject ? (
              <PortalProjectView workspaceId={workspaceId} projectId={openProject} onBack={() => setOpenProject(null)} />
            ) : (
              <OverviewTab overview={overview} onOpenProject={setOpenProject} />
            ))}
          {tab === 'deliverables' && <DeliverablesTab workspaceId={workspaceId} />}
          {tab === 'approvals' && <ApprovalsTab workspaceId={workspaceId} />}
          {tab === 'requests' && <RequestsTab workspaceId={workspaceId} />}
        </div>
      </Scrollable>
    </div>
  );
}

function OverviewTab({
  overview,
  onOpenProject,
}: {
  overview: ReturnType<typeof usePortalOverview>;
  onOpenProject: (id: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  if (overview.isLoading) return <Skeleton className="h-48 w-full" />;
  if (overview.isError) return <ErrorState title={t('errors.generic')} onRetry={() => void overview.refetch()} />;
  const data = overview.data!;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t('portal.pendingApprovals')} value={data.pendingApprovals} />
        <Stat label={t('portal.openRequests')} value={data.openRequests} />
        <Stat label={t('portal.projects')} value={data.projects.length} />
      </div>

      {data.projects.length === 0 ? (
        <EmptyState title={t('portal.noProjects')} />
      ) : (
        <div className="space-y-2">
          {data.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-start hover:bg-surface-sunken"
            >
              <span className="font-mono text-xs text-text-subtle">{p.key}</span>
              <span className="font-medium text-text">{p.name}</span>
              <span className="ms-auto text-xs text-text-muted">
                {p.openTasks}/{p.totalTasks} {t('portal.openTasks')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="text-2xl font-semibold text-text">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}

function PortalProjectView({
  workspaceId,
  projectId,
  onBack,
}: {
  workspaceId: string;
  projectId: string;
  onBack: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const detail = usePortalProject(workspaceId, projectId);

  if (detail.isLoading) return <Skeleton className="h-64 w-full" />;
  if (detail.isError || !detail.data) return <ErrorState title={t('errors.generic')} onRetry={() => void detail.refetch()} />;
  const d = detail.data;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text">
        <ArrowLeft className="size-4" />
        {t('portal.backToOverview')}
      </button>
      <h1 className="text-lg font-semibold text-text">
        <span className="me-2 font-mono text-sm text-text-subtle">{d.project.key}</span>
        {d.project.name}
      </h1>

      <Section title={t('portal.milestones')}>
        {d.milestones.length === 0 ? (
          <p className="text-sm text-text-subtle">—</p>
        ) : (
          d.milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="text-text">{m.name}</span>
              <span className="text-xs text-text-subtle">{format(new Date(m.date), 'MMM d, yyyy')}</span>
              <span className="ms-auto text-xs text-text-muted">
                {m.progress.done}/{m.progress.total}
              </span>
            </div>
          ))
        )}
      </Section>

      <Section title={t('portal.tasks')}>
        {d.tasks.length === 0 ? (
          <p className="text-sm text-text-subtle">—</p>
        ) : (
          d.tasks.map((tk) => (
            <div key={tk.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="font-mono text-[11px] text-text-subtle">{tk.key}</span>
              <span className="text-text">{tk.title}</span>
              <Badge tone="neutral">{tk.status}</Badge>
              {tk.dueDate && <span className="ms-auto text-xs text-text-subtle">{format(new Date(tk.dueDate), 'MMM d')}</span>}
            </div>
          ))
        )}
      </Section>

      <Section title={t('portal.deliverables')}>
        {d.deliverables.length === 0 ? (
          <p className="text-sm text-text-subtle">—</p>
        ) : (
          d.deliverables.map((dl) => <DeliverableRow key={dl.id} deliverable={dl} />)
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section>
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface px-4 py-1">{children}</div>
    </section>
  );
}

function DeliverableRow({ deliverable: dl }: { deliverable: DeliverableView }): React.ReactElement {
  const { t } = useTranslation();
  const latest = dl.versions[0];
  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <span className="text-text">{dl.title}</span>
      <Badge tone={dl.status === 'approved' || dl.status === 'delivered' ? 'success' : 'warning'}>
        {t(`external.deliverables.status.${dl.status}`)}
      </Badge>
      {latest && (
        <a
          href={latest.url}
          target="_blank"
          rel="noreferrer"
          className="ms-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Download className="size-3.5" />
          v{latest.version}
        </a>
      )}
    </div>
  );
}

function DeliverablesTab({ workspaceId }: { workspaceId: string }): React.ReactElement {
  const { t } = useTranslation();
  const q = usePortalDeliverables(workspaceId);
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorState title={t('errors.generic')} onRetry={() => void q.refetch()} />;
  if (q.data!.length === 0) return <EmptyState title={t('external.deliverables.empty')} />;
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface px-4 py-1">
      {q.data!.map((dl) => (
        <DeliverableRow key={dl.id} deliverable={dl} />
      ))}
    </div>
  );
}

function ApprovalsTab({ workspaceId }: { workspaceId: string }): React.ReactElement {
  const { t } = useTranslation();
  const myUserId = useAuth((s) => s.user?.id ?? '');
  const q = usePortalApprovals(workspaceId);
  const decide = useDecideApproval(workspaceId);

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorState title={t('errors.generic')} onRetry={() => void q.refetch()} />;
  if (q.data!.length === 0) return <EmptyState title={t('external.approvals.empty')} />;

  const act = (approvalId: string, stepId: string, decision: ApprovalDecision): void => {
    decide.mutate(
      { approvalId, stepId, decision },
      {
        onSuccess: () => {
          toast.success(t('external.approvals.decided'));
          void q.refetch();
        },
        onError: (e) => toast.error(errorText(e, t)),
      },
    );
  };

  return (
    <div className="space-y-3">
      {q.data!.map((a) => {
        const myStep = a.steps.find((s) => s.approverUserId === myUserId && s.actionable && !s.decision);
        return (
          <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text">{a.title}</span>
              <span className="text-xs text-text-subtle">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
            </div>
            {a.description && <p className="mt-1 text-sm text-text-muted">{a.description}</p>}
            {myStep ? (
              <div className="mt-3 flex gap-2">
                <Button size="sm" loading={decide.isPending} onClick={() => act(a.id, myStep.id, 'approved')}>
                  <CheckCircle2 className="size-3.5" />
                  {t('external.approvals.approve')}
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => act(a.id, myStep.id, 'rejected')}>
                  {t('external.approvals.reject')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act(a.id, myStep.id, 'changes_requested')}>
                  {t('external.approvals.requestChanges')}
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-subtle">{t('external.approvals.awaitingOthers')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequestsTab({ workspaceId }: { workspaceId: string }): React.ReactElement {
  const { t } = useTranslation();
  const q = usePortalRequests(workspaceId);
  const create = useCreatePortalRequest(workspaceId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t('portal.newRequest')}
        </Button>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <ErrorState title={t('errors.generic')} onRetry={() => void q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState title={t('external.requests.empty')} />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {q.data!.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Badge tone={r.status === 'converted' || r.status === 'accepted' ? 'success' : r.status === 'declined' ? 'danger' : 'neutral'}>
                  {t(`external.requests.status.${r.status}`)}
                </Badge>
                <span className="font-medium text-text">{r.title}</span>
                <span className="ms-auto text-xs text-text-subtle">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
              </div>
              {r.description && <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{r.description}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('portal.newRequest')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={create.isPending}
              disabled={!title.trim()}
              onClick={() =>
                create.mutate(
                  { title: title.trim(), description: details.trim() || undefined },
                  {
                    onSuccess: () => {
                      toast.success(t('portal.requestSent'));
                      setOpen(false);
                      setTitle('');
                      setDetails('');
                    },
                    onError: (e) => toast.error(errorText(e, t)),
                  },
                )
              }
            >
              {t('portal.submitRequest')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('portal.requestTitle')}>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('portal.requestDetails')}>
            <Textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
