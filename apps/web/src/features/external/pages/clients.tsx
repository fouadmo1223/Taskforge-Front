import { useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { Archive, ArchiveRestore, ExternalLink, Pencil, Plus } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProjects } from '@/features/projects/projects.api';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, MultiSelect, Skeleton, Textarea, toast } from '@/components/ui';
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useSetClientProjects,
  useUpdateClient,
  type ClientView,
} from '@/features/external/external.api';

interface DraftClient {
  id?: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  notes: string;
}

const emptyDraft: DraftClient = { name: '', contactName: '', contactEmail: '', contactPhone: '', website: '', notes: '' };

export function ClientsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const [showArchived, setShowArchived] = useState(false);
  const clients = useClients(workspaceId, showArchived);
  const projects = useProjects(workspaceId);
  const create = useCreateClient(workspaceId);
  const update = useUpdateClient(workspaceId);
  const setProjects = useSetClientProjects(workspaceId);
  const del = useDeleteClient(workspaceId);
  const manage = can('client.manage');

  const [draft, setDraft] = useState<DraftClient | null>(null);

  const save = (): void => {
    if (!draft) return;
    const body = {
      name: draft.name.trim(),
      contactName: draft.contactName.trim(),
      contactEmail: draft.contactEmail.trim(),
      contactPhone: draft.contactPhone.trim(),
      website: draft.website.trim(),
      notes: draft.notes.trim(),
    };
    if (!body.name) return;
    const onDone = {
      onSuccess: () => {
        toast.success(t('external.clients.saved'));
        setDraft(null);
      },
      onError: (e: unknown) => toast.error(errorText(e, t)),
    };
    if (draft.id) update.mutate({ id: draft.id, ...body }, onDone);
    else create.mutate(body, onDone);
  };

  return (
    <>
      <PageHeader
        title={t('external.clients.title')}
        description={t('external.clients.description')}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
              {t('external.clients.showArchived')}
            </Button>
            {manage && (
              <Button size="sm" onClick={() => setDraft({ ...emptyDraft })}>
                <Plus className="size-4" />
                {t('external.clients.newClient')}
              </Button>
            )}
          </>
        }
      />
      <PageBody className="space-y-3">
        {clients.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : clients.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void clients.refetch()} />
        ) : clients.data!.length === 0 ? (
          <EmptyState title={t('external.clients.empty')} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {clients.data!.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                projects={projects.data ?? []}
                canManage={manage}
                onEdit={() =>
                  setDraft({
                    id: c.id,
                    name: c.name,
                    contactName: c.contactName,
                    contactEmail: c.contactEmail,
                    contactPhone: c.contactPhone,
                    website: c.website,
                    notes: c.notes,
                  })
                }
                onToggleArchive={() =>
                  update.mutate(
                    { id: c.id, status: c.status === 'active' ? 'archived' : 'active' },
                    { onError: (e) => toast.error(errorText(e, t)) },
                  )
                }
                onSetProjects={(ids) => setProjects.mutate({ id: c.id, projectIds: ids })}
                onDelete={() =>
                  del.mutate(c.id, {
                    onSuccess: () => toast.success(t('external.clients.deleted')),
                    onError: (e) => toast.error(errorText(e, t)),
                  })
                }
              />
            ))}
          </div>
        )}
      </PageBody>

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t('external.clients.editClient') : t('external.clients.newClient')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={create.isPending || update.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
            <Field label={t('external.clients.name')} className="sm:col-span-2">
              <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('external.clients.contactName')}>
              <Input value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} />
            </Field>
            <Field label={t('external.clients.contactEmail')}>
              <Input type="email" value={draft.contactEmail} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} />
            </Field>
            <Field label={t('external.clients.contactPhone')}>
              <Input value={draft.contactPhone} onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })} />
            </Field>
            <Field label={t('external.clients.website')}>
              <Input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
            </Field>
            <Field label={t('external.clients.notes')} className="sm:col-span-2">
              <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}

function ClientRow({
  client,
  projects,
  canManage,
  onEdit,
  onToggleArchive,
  onSetProjects,
  onDelete,
}: {
  client: ClientView;
  projects: { id: string; name: string; key: string }[];
  canManage: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onSetProjects: (ids: string[]) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [editingProjects, setEditingProjects] = useState(false);
  return (
    <div className="bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-text">{client.name}</span>
        {client.status === 'archived' && <Badge tone="neutral">{t('external.clients.archived')}</Badge>}
        {client.contactEmail && <span className="text-sm text-text-muted">{client.contactEmail}</span>}
        {client.website && (
          <a
            href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            {client.website}
          </a>
        )}
        {canManage && (
          <div className="ms-auto flex items-center gap-1">
            <button onClick={() => setEditingProjects((v) => !v)} className="rounded-lg px-2 py-1 text-xs text-text-muted hover:bg-surface-sunken">
              {t('external.clients.linkedProjects')} ({client.projectIds.length})
            </button>
            <button onClick={onEdit} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken" aria-label={t('common.edit')}>
              <Pencil className="size-3.5" />
            </button>
            <button onClick={onToggleArchive} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken" aria-label={t('external.clients.archive')}>
              {client.status === 'active' ? <Archive className="size-3.5" /> : <ArchiveRestore className="size-3.5" />}
            </button>
          </div>
        )}
      </div>
      {client.notes && <p className="mt-1 text-sm text-text-muted">{client.notes}</p>}
      {editingProjects && (
        <div className="mt-2 flex items-center gap-2">
          <MultiSelect
            value={client.projectIds}
            onChange={onSetProjects}
            options={projects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
            placeholder={t('external.clients.linkedProjects')}
            className="max-w-md"
          />
          <button onClick={onDelete} className="text-xs text-danger hover:underline">
            {t('common.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
