import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { feedback } from '@/lib/api/mutation-feedback';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Button, Dialog, EmptyState, ErrorState, Field, Input, MultiSelect, Skeleton, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  useCreatePortfolio,
  useDeletePortfolio,
  usePortfolioRollup,
  usePortfolios,
} from '@/features/strategy/strategy.api';

export function PortfoliosPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const portfolios = usePortfolios(workspaceId);
  const projects = useProjects(workspaceId);
  const create = useCreatePortfolio(workspaceId);
  const del = useDeletePortfolio(workspaceId);
  const manage = can('portfolio.manage');

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', projectIds: [] as string[] });
  const [expanded, setExpanded] = useState<string | null>(null);

  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }));

  return (
    <>
      <PageHeader
        title={t('strategy.portfolios')}
        description={t('strategy.portfoliosDesc')}
        actions={
          manage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('strategy.newPortfolio')}
            </Button>
          )
        }
      />
      <PageBody className="space-y-2">
        {portfolios.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : portfolios.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void portfolios.refetch()} />
        ) : portfolios.data!.length === 0 ? (
          <EmptyState title={t('strategy.noPortfolios')} />
        ) : (
          portfolios.data!.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-border">
              <button
                onClick={() => setExpanded((v) => (v === p.id ? null : p.id))}
                className="flex w-full items-center gap-2 bg-surface px-4 py-3 text-start hover:bg-surface-sunken"
              >
                {expanded === p.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <span className="size-2.5 rounded" style={{ backgroundColor: p.color }} />
                <span className="font-medium text-text">{p.name}</span>
                <span className="text-xs text-text-subtle">{p.projectIds.length} {t('nav.projects')}</span>
                {manage && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate(p.id, feedback(t, { success: t('common.deleted') }));
                    }}
                    className="ms-auto rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </span>
                )}
              </button>
              {expanded === p.id && <PortfolioRollup portfolioId={p.id} />}
            </div>
          ))
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('strategy.newPortfolio')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!draft.name.trim()}
              onClick={() =>
                create.mutate(
                  { name: draft.name.trim(), description: draft.description.trim(), projectIds: draft.projectIds },
                  {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.created') }).onSuccess();
                      setCreating(false);
                      setDraft({ name: '', description: '', projectIds: [] });
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
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('strategy.portfolioName')}>
            <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={t('external.forms.formDescription')}>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label={t('nav.projects')}>
            <MultiSelect value={draft.projectIds} onChange={(v) => setDraft({ ...draft, projectIds: v })} options={projectOptions} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

function PortfolioRollup({ portfolioId }: { portfolioId: string }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const rollup = usePortfolioRollup(workspaceId, portfolioId);

  if (rollup.isLoading) return <Skeleton className="m-3 h-24" />;
  if (!rollup.data) return <p className="p-4 text-sm text-text-subtle">—</p>;
  const d = rollup.data;

  return (
    <div className="border-t border-border bg-surface-sunken/40 p-4">
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <span className="text-text-muted">{t('portal.openTasks')}: <span className="font-semibold text-text">{d.totals.openTasks}/{d.totals.totalTasks}</span></span>
        <span className="text-text-muted">{t('strategy.completion')}: <span className="font-semibold text-text">{Math.round(d.totals.doneRatio * 100)}%</span></span>
      </div>
      <div className="space-y-1.5">
        {d.projects.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span className="w-16 shrink-0 font-mono text-xs text-text-subtle">{p.key}</span>
            <span className="min-w-0 flex-1 truncate text-text">{p.name}</span>
            <div className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
              <div className={cn('h-full', p.doneRatio >= 1 ? 'bg-success' : 'bg-primary')} style={{ width: `${p.doneRatio * 100}%` }} />
            </div>
            <span className="w-14 shrink-0 text-end text-xs text-text-subtle">{p.openTasks}/{p.totalTasks}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
