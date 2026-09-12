import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TEMPLATE_KINDS, type TemplateKind } from '@flowdesk/types';
import { FileStack, Play, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { errorText } from '@/lib/api/errors';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Textarea, toast } from '@/components/ui';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useInstantiateTemplate,
  useTemplates,
  type TemplateView,
} from '@/features/templates/templates.api';

/** One task-tree line per row: "Title" or "  Subtitle" (2-space indent = subtask). */
function parseTaskLines(text: string): { title: string; subtasks: unknown[] }[] {
  const lines = text.split('\n').filter((l) => l.trim());
  const root: { title: string; subtasks: unknown[] }[] = [];
  let last: { title: string; subtasks: unknown[] } | null = null;
  for (const line of lines) {
    const indented = /^\s{2,}/.test(line);
    const node = { title: line.trim(), subtasks: [] as unknown[] };
    if (indented && last) last.subtasks.push(node);
    else {
      root.push(node);
      last = node;
    }
  }
  return root;
}

export function TemplatesPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const templates = useTemplates(workspaceId);
  const create = useCreateTemplate(workspaceId);
  const del = useDeleteTemplate(workspaceId);
  const instantiate = useInstantiateTemplate(workspaceId);
  const projects = useProjects(workspaceId);
  const manage = can('template.manage');
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ kind: 'task' as TemplateKind, name: '', description: '', lines: '' });
  const [useFor, setUseFor] = useState<TemplateView | null>(null);
  const [target, setTarget] = useState({ projectId: '', name: '', key: '' });

  return (
    <>
      <PageHeader
        title={t('templates.title')}
        description={t('templates.description')}
        actions={
          manage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('templates.newTemplate')}
            </Button>
          )
        }
      />
      <PageBody className="space-y-2">
        {templates.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : templates.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void templates.refetch()} />
        ) : templates.data!.length === 0 ? (
          <EmptyState title={t('templates.empty')} icon={<FileStack className="size-5" />} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {templates.data!.map((tpl) => (
              <div key={tpl.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-3 text-sm">
                <Badge tone="primary">{t(`templates.kind.${tpl.kind}`)}</Badge>
                <span className="font-medium text-text">{tpl.name}</span>
                {tpl.description && <span className="text-xs text-text-subtle">{tpl.description}</span>}
                <span className="text-xs text-text-subtle">{t('templates.usedCount', { count: tpl.useCount })}</span>
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setUseFor(tpl);
                      setTarget({ projectId: projects.data?.[0]?.id ?? '', name: `${tpl.name} copy`, key: '' });
                    }}
                  >
                    <Play className="size-3.5" />
                    {t('templates.use')}
                  </Button>
                  {manage && (
                    <button onClick={() => del.mutate(tpl.id, { onError: err })} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-danger">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('templates.newTemplate')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!draft.name.trim() || !draft.lines.trim()}
              onClick={() => {
                const tasks = parseTaskLines(draft.lines);
                const payload =
                  draft.kind === 'task'
                    ? (Array.isArray(tasks) && tasks[0] ? tasks[0] : { title: draft.name })
                    : { tasks };
                create.mutate(
                  { kind: draft.kind, name: draft.name.trim(), description: draft.description.trim(), payload: payload as Record<string, unknown> },
                  {
                    onSuccess: () => {
                      setCreating(false);
                      setDraft({ kind: 'task', name: '', description: '', lines: '' });
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
          <Field label={t('templates.kindLabel')}>
            <Select value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v ?? 'task' })} options={TEMPLATE_KINDS.map((k) => ({ value: k, label: t(`templates.kind.${k}`) }))} />
          </Field>
          <Field label={t('templates.templateName')}>
            <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={t('external.forms.formDescription')}>
            <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label={t('templates.taskLines')} hint={t('templates.taskLinesHint')}>
            <Textarea rows={6} value={draft.lines} onChange={(e) => setDraft({ ...draft, lines: e.target.value })} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={useFor !== null}
        onOpenChange={(o) => !o && setUseFor(null)}
        title={t('templates.use')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setUseFor(null)}>{t('common.cancel')}</Button>
            <Button
              loading={instantiate.isPending}
              disabled={useFor?.kind === 'task' ? !target.projectId : !target.name.trim()}
              onClick={() => {
                if (!useFor) return;
                instantiate.mutate(
                  useFor.kind === 'task'
                    ? { id: useFor.id, kind: 'task', projectId: target.projectId }
                    : { id: useFor.id, kind: 'project', name: target.name.trim(), key: target.key.trim() || undefined },
                  {
                    onSuccess: (res) => {
                      toast.success(t('templates.instantiated', { count: res.created }));
                      setUseFor(null);
                    },
                    onError: err,
                  },
                );
              }}
            >
              {t('templates.use')}
            </Button>
          </>
        }
      >
        {useFor?.kind === 'task' ? (
          <Field label={t('templates.intoProject')}>
            <Select
              value={target.projectId || null}
              onChange={(v) => setTarget({ ...target, projectId: v ?? '' })}
              options={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
              searchable
            />
          </Field>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            <Field label={t('templates.newProjectName')}>
              <Input autoFocus value={target.name} onChange={(e) => setTarget({ ...target, name: e.target.value })} />
            </Field>
            <Field label={`${t('projects.key' as never, { defaultValue: 'Key' })} (${t('common.optional')})`}>
              <Input maxLength={6} className="uppercase" value={target.key} onChange={(e) => setTarget({ ...target, key: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
