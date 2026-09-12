import { useEffect, useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { FORM_FIELD_TYPES, TASK_PRIORITIES, type FormFieldType } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Textarea, toast } from '@/components/ui';
import {
  useCreateForm,
  useDeleteForm,
  useForm,
  useForms,
  useFormSubmissions,
  useUpdateForm,
  type FormFieldView,
  type FormView,
} from '@/features/external/external.api';

const STATUS_TONE = { draft: 'neutral', published: 'success', closed: 'danger' } as const;
const CHOICE_TYPES: FormFieldType[] = ['radio', 'select', 'multi_select'];

export function FormsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const forms = useForms(workspaceId);
  const create = useCreateForm(workspaceId);
  const manage = can('form.manage');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  if (editingId) {
    return <FormEditor formId={editingId} onBack={() => setEditingId(null)} canManage={manage} />;
  }

  return (
    <>
      <PageHeader
        title={t('external.forms.title')}
        description={t('external.forms.description')}
        actions={
          manage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('external.forms.newForm')}
            </Button>
          )
        }
      />
      <PageBody className="space-y-2">
        {forms.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : forms.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void forms.refetch()} />
        ) : forms.data!.length === 0 ? (
          <EmptyState title={t('external.forms.empty')} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {forms.data!.map((f) => (
              <button
                key={f.id}
                onClick={() => setEditingId(f.id)}
                className="flex w-full items-center gap-3 bg-surface px-4 py-3 text-start hover:bg-surface-sunken"
              >
                <Badge tone={STATUS_TONE[f.status]}>{t(`external.forms.status.${f.status}`)}</Badge>
                <span className="font-medium text-text">{f.title}</span>
                <span className="text-xs text-text-subtle">
                  {t('external.forms.submittedCount', { count: f.submissionCount })}
                </span>
                <span className="ms-auto text-xs text-text-subtle">{f.fields.length} {t('external.forms.fields')}</span>
              </button>
            ))}
          </div>
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('external.forms.newForm')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={create.isPending}
              disabled={!newTitle.trim()}
              onClick={() =>
                create.mutate(
                  { title: newTitle.trim() },
                  {
                    onSuccess: (f) => {
                      setCreating(false);
                      setNewTitle('');
                      setEditingId(f.id);
                    },
                    onError: (e) => toast.error(errorText(e, t)),
                  },
                )
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <Field label={t('external.forms.formTitle')}>
          <Input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        </Field>
      </Dialog>
    </>
  );
}

function FormEditor({ formId, onBack, canManage }: { formId: string; onBack: () => void; canManage: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const query = useForm(workspaceId, formId);
  const projects = useProjects(workspaceId);
  const update = useUpdateForm(workspaceId);
  const del = useDeleteForm(workspaceId);
  const submissions = useFormSubmissions(workspaceId, formId);

  const [local, setLocal] = useState<FormView | null>(null);
  useEffect(() => {
    if (query.data) setLocal(query.data);
  }, [query.data]);

  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };
  const publicUrl = local ? `${window.location.origin}/f/${local.slug}` : '';

  const save = (patch: Partial<FormView>): void => {
    if (!local) return;
    const next = { ...local, ...patch };
    setLocal(next);
    update.mutate(
      {
        id: formId,
        title: next.title,
        description: next.description,
        successMessage: next.successMessage,
        visibility: next.visibility,
        fields: next.fields,
        routing: next.routing,
      },
      { onSuccess: () => toast.success(t('external.forms.saved')), onError: err },
    );
  };

  if (query.isLoading || !local) {
    return (
      <>
        <PageHeader title={t('external.forms.title')} />
        <PageBody>
          <Skeleton className="h-64 w-full" />
        </PageBody>
      </>
    );
  }

  const setField = (idx: number, patch: Partial<FormFieldView>, commit = false): void => {
    const fields = local.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    if (commit) save({ fields });
    else setLocal({ ...local, fields });
  };
  const addField = (): void => {
    const field: FormFieldView = {
      id: `tmp-${Date.now()}`,
      type: 'text',
      label: '',
      description: '',
      placeholder: '',
      required: false,
      options: [],
      order: local.fields.length,
    };
    setLocal({ ...local, fields: [...local.fields, field] });
  };
  const removeField = (idx: number): void => save({ fields: local.fields.filter((_, i) => i !== idx) });

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <button onClick={onBack} className="rounded-lg p-1 text-text-muted hover:bg-surface-sunken">
              <ArrowLeft className="size-4" />
            </button>
            {local.title}
          </span>
        }
        actions={
          canManage && (
            <>
              {local.status === 'draft' ? (
                <Button size="sm" onClick={() => save({ status: 'published' } as Partial<FormView>)} loading={update.isPending}>
                  {t('external.forms.publish')}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => save({ status: 'draft' } as Partial<FormView>)}>
                  {t('external.forms.unpublish')}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() =>
                  del.mutate(formId, { onSuccess: onBack, onError: err })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )
        }
      />
      <PageBody className="space-y-6">
        <Badge tone={STATUS_TONE[local.status]}>{t(`external.forms.status.${local.status}`)}</Badge>

        {local.status !== 'draft' && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span className="text-text-subtle">{t('external.forms.publicLink')}</span>
            <code className="truncate text-text">{publicUrl}</code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(publicUrl);
                toast.success(t('external.forms.linkCopied'));
              }}
              className="ms-auto rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        )}

        <section className="space-y-3">
          <Field label={t('external.forms.formTitle')}>
            <Input
              value={local.title}
              disabled={!canManage}
              onChange={(e) => setLocal({ ...local, title: e.target.value })}
              onBlur={() => local.title !== query.data?.title && save({})}
            />
          </Field>
          <Field label={t('external.forms.formDescription')}>
            <Textarea
              rows={2}
              value={local.description}
              disabled={!canManage}
              onChange={(e) => setLocal({ ...local, description: e.target.value })}
              onBlur={() => save({})}
            />
          </Field>
          <Field label={t('external.forms.successMessage')}>
            <Input
              value={local.successMessage}
              disabled={!canManage}
              onChange={(e) => setLocal({ ...local, successMessage: e.target.value })}
              onBlur={() => save({})}
            />
          </Field>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('external.forms.fields')}</h2>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={addField}>
                <Plus className="size-3.5" />
                {t('external.forms.addField')}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {local.fields.map((f, idx) => (
              <div key={f.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2 size-4 shrink-0 text-text-subtle" />
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem]">
                    <Input
                      placeholder={t('external.forms.fieldLabel')}
                      value={f.label}
                      disabled={!canManage}
                      onChange={(e) => setField(idx, { label: e.target.value })}
                      onBlur={() => save({})}
                    />
                    <Select
                      value={f.type}
                      onChange={(v) => setField(idx, { type: v ?? 'text' }, true)}
                      disabled={!canManage}
                      options={FORM_FIELD_TYPES.map((ft) => ({ value: ft, label: t(`external.forms.fieldTypes.${ft}`) }))}
                      size="sm"
                    />
                  </div>
                  {canManage && (
                    <button onClick={() => removeField(idx)} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="ms-6 mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-text-muted">
                    <input
                      type="checkbox"
                      checked={f.required}
                      disabled={!canManage}
                      onChange={(e) => setField(idx, { required: e.target.checked }, true)}
                      className="size-3.5 rounded border-border"
                    />
                    {t('external.forms.required')}
                  </label>
                </div>
                {CHOICE_TYPES.includes(f.type) && (
                  <div className="ms-6 mt-2">
                    <Textarea
                      rows={2}
                      placeholder={t('external.forms.options')}
                      disabled={!canManage}
                      value={f.options.map((o) => o.label).join('\n')}
                      onChange={(e) =>
                        setField(idx, {
                          options: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((label) => ({ label, value: label.toLowerCase().replace(/\s+/g, '_') })),
                        })
                      }
                      onBlur={() => save({})}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={local.routing.enabled}
              disabled={!canManage}
              onChange={(e) => { const routing = { ...local.routing, enabled: e.target.checked }; setLocal({ ...local, routing }); save({ routing }); }}
              className="size-4 rounded border-border"
            />
            {t('external.forms.routing')}
          </label>
          {local.routing.enabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('external.forms.routeToProject')}>
                <Select
                  value={local.routing.projectId}
                  onChange={(v) => { const routing = { ...local.routing, projectId: v }; setLocal({ ...local, routing }); save({ routing }); }}
                  options={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
                  clearable
                  searchable
                  disabled={!canManage}
                />
              </Field>
              <Field label={t('external.forms.routePriority')}>
                <Select
                  value={local.routing.priority}
                  onChange={(v) => { const routing = { ...local.routing, priority: v ?? 'medium' }; setLocal({ ...local, routing }); save({ routing }); }}
                  options={TASK_PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) }))}
                  disabled={!canManage}
                />
              </Field>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('external.forms.submissions')}</h2>
          {submissions.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (submissions.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-subtle">{t('external.forms.noSubmissions')}</p>
          ) : (
            <div className="space-y-2">
              {submissions.data!.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 text-xs text-text-subtle">
                    <span>{s.submitterName || '—'}</span>
                    {s.submitterEmail && <span>· {s.submitterEmail}</span>}
                    {s.requestId && <Badge tone="primary">{t('external.requests.title')}</Badge>}
                  </div>
                  <dl className="space-y-0.5">
                    {local.fields.map((f) =>
                      s.answers[f.id] !== undefined ? (
                        <div key={f.id} className="flex gap-2">
                          <dt className="text-text-subtle">{f.label}:</dt>
                          <dd className="text-text">{String(Array.isArray(s.answers[f.id]) ? (s.answers[f.id] as string[]).join(', ') : s.answers[f.id])}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}
