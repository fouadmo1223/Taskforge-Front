import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { FolderKanban, Plus } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useCreateProject, useProjects } from '@/features/projects/projects.api';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Button, Dialog, EmptyState, ErrorState, Field, Input, Skeleton, Textarea, toast } from '@/components/ui';

const schema = z.object({
  name: z.string().min(2).max(120),
  key: z.string().regex(/^[A-Za-z]{2,6}$/, 'Optional: 2–6 letters').or(z.literal('')),
  description: z.string().max(2000).optional(),
});
type Values = z.infer<typeof schema>;

export function ProjectsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, slug, can } = useWorkspace();
  const projects = useProjects(workspaceId);
  const create = useCreateProject(workspaceId);
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', key: '', description: '' } });

  const submit = form.handleSubmit(async (values) => {
    try {
      const project = await create.mutateAsync({
        name: values.name,
        key: values.key || undefined,
        description: values.description || undefined,
      });
      setOpen(false);
      form.reset();
      toast.success(t('projects.created'), project.name);
    } catch (err) {
      toast.error(t('projects.createTitle'), err instanceof ApiError ? err.message : t('errors.generic'));
    }
  });

  return (
    <>
      <PageHeader
        title={t('nav.projects')}
        actions={
          can('project.create') && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              {t('projects.create')}
            </Button>
          )
        }
      />
      <PageBody>
        {projects.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : projects.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void projects.refetch()} retryLabel={t('common.retry')} />
        ) : (projects.data ?? []).length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="size-6" />}
            title={t('projects.emptyTitle')}
            description={t('projects.emptyBody')}
            action={
              can('project.create') && (
                <Button onClick={() => setOpen(true)}>
                  <Plus className="size-4" />
                  {t('projects.create')}
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data!.map((p) => (
              <Link
                key={p.id}
                to={`/w/${slug}/projects/${p.id}`}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded" style={{ backgroundColor: p.color }} />
                  <span className="font-mono text-xs text-text-subtle">{p.key}</span>
                  {p.archived && <span className="rounded bg-surface-sunken px-1.5 text-[10px] text-text-subtle">{t('projects.archived')}</span>}
                </div>
                <p className="font-medium text-text">{p.name}</p>
                <p className="line-clamp-2 text-sm text-text-muted">{p.description || t('projects.noDescription')}</p>
              </Link>
            ))}
          </div>
        )}
      </PageBody>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('projects.createTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              {t('projects.create')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4 py-1">
          <Field label={t('projects.name')} error={form.formState.errors.name?.message}>
            <Input autoFocus placeholder="Marketing Website" {...form.register('name')} />
          </Field>
          <Field label={`${t('projects.key')} (${t('common.optional')})`} error={form.formState.errors.key?.message}>
            <Input placeholder="MKT" maxLength={6} className="uppercase" {...form.register('key')} />
          </Field>
          <Field label={t('projects.description')}>
            <Textarea rows={3} {...form.register('description')} />
          </Field>
        </form>
      </Dialog>
    </>
  );
}
