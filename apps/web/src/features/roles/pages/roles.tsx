import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PERMISSION_GROUPS, type Permission } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import {
  roleLabel,
  useCreateRole,
  useDeleteRole,
  useRoles,
  useUpdateRole,
  type RoleView,
} from '@/features/roles/roles.api';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, Field, Input, Skeleton, Textarea, confirm, toast } from '@/components/ui';

function permLabel(p: string): string {
  return p.split('.')[1]?.replace(/_/g, ' ') ?? p;
}

export function RolesPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const roles = useRoles(workspaceId);
  const createRole = useCreateRole(workspaceId);
  const updateRole = useUpdateRole(workspaceId);
  const deleteRole = useDeleteRole(workspaceId);
  const [editing, setEditing] = useState<RoleView | 'new' | null>(null);

  const canManage = can('roles.manage');

  return (
    <>
      <PageHeader
        title={t('roles.title')}
        actions={
          canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" />
              {t('roles.create')}
            </Button>
          )
        }
      />
      <PageBody>
        {roles.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (roles.data ?? []).length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-6" />} title={t('roles.title')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.data!.map((role) => (
              <button
                key={role.id}
                disabled={!canManage || role.isOwner}
                onClick={() => setEditing(role)}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-start transition-colors',
                  canManage && !role.isOwner && 'hover:border-border-strong hover:bg-surface-sunken',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text">{roleLabel(role, t)}</span>
                  {role.system && <Badge>{t('roles.system')}</Badge>}
                  {role.isDefault && <Badge tone="primary">{t('roles.default')}</Badge>}
                </div>
                <p className="line-clamp-2 text-sm text-text-muted">{role.description || '—'}</p>
                <span className="text-xs text-text-subtle">
                  {role.isOwner
                    ? '—'
                    : t('roles.permissionsCount', { count: role.permissions.length })}
                </span>
              </button>
            ))}
          </div>
        )}
      </PageBody>

      {editing && (
        <RoleEditorDialog
          role={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            try {
              if (editing === 'new') {
                await createRole.mutateAsync(values);
                toast.success(t('roles.createTitle'), values.name);
              } else {
                await updateRole.mutateAsync({ roleId: editing.id, ...values });
                toast.success(t('common.save'), values.name);
              }
              setEditing(null);
            } catch (err) {
              toast.error(t('roles.title'), err instanceof ApiError ? err.message : t('errors.generic'));
            }
          }}
          onDelete={
            editing !== 'new' && !editing.system
              ? async () => {
                  const ok = await confirm({
                    title: t('common.delete'),
                    body: editing.name,
                    tone: 'danger',
                    confirmLabel: t('common.delete'),
                  });
                  if (!ok) return;
                  try {
                    await deleteRole.mutateAsync(editing.id);
                    setEditing(null);
                  } catch (err) {
                    toast.error(t('common.delete'), err instanceof ApiError ? err.message : t('errors.generic'));
                  }
                }
              : undefined
          }
          onMakeDefault={
            editing !== 'new' && !editing.isDefault && !editing.isOwner
              ? async () => {
                  try {
                    await updateRole.mutateAsync({ roleId: editing.id, isDefault: true });
                    toast.success(t('roles.makeDefault'), editing.name);
                    setEditing(null);
                  } catch (err) {
                    toast.error(t('roles.makeDefault'), err instanceof ApiError ? err.message : t('errors.generic'));
                  }
                }
              : undefined
          }
          saving={createRole.isPending || updateRole.isPending}
        />
      )}
    </>
  );
}

function RoleEditorDialog({
  role,
  onClose,
  onSubmit,
  onDelete,
  onMakeDefault,
  saving,
}: {
  role: RoleView | null;
  onClose: () => void;
  onSubmit: (values: { name: string; description?: string; permissions: Permission[] }) => void;
  onDelete?: () => void;
  onMakeDefault?: () => void;
  saving: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const adminLocked = role?.system && role.key === 'admin';

  const toggle = (p: Permission): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  const toggleGroup = (perms: Permission[]): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = perms.every((p) => next.has(p));
      for (const p of perms) allOn ? next.delete(p) : next.add(p);
      return next;
    });

  const count = useMemo(() => selected.size, [selected]);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={role ? roleLabel(role, t) : t('roles.createTitle')}
      description={t('roles.permissions') + (adminLocked ? ' · locked' : '')}
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="text-danger" onClick={onDelete}>
              <Trash2 className="size-4" />
              {t('common.delete')}
            </Button>
          )}
          {onMakeDefault && (
            <Button variant="ghost" onClick={onMakeDefault}>
              {t('roles.makeDefault')}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={saving}
            disabled={!name.trim() || (adminLocked ?? false)}
            onClick={() => onSubmit({ name, description, permissions: [...selected] })}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('roles.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={role?.isOwner} autoFocus />
          </Field>
          <Field label={t('roles.description')}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        {description.length > 60 && (
          <Field label={t('roles.description')}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
        )}

        <p className="text-xs text-text-subtle">{t('roles.permissionsCount', { count })}</p>

        <div className={cn('flex flex-col gap-3', adminLocked && 'pointer-events-none opacity-60')}>
          {PERMISSION_GROUPS.map((group) => {
            const allOn = group.permissions.every((p) => selected.has(p));
            return (
              <div key={group.key} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{group.key}</span>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.permissions as Permission[])}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {allOn ? '—' : t('roles.selectAll')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.permissions.map((p) => {
                    const on = selected.has(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggle(p)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                          on
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-border text-text-muted hover:border-border-strong',
                        )}
                      >
                        {on && <Check className="size-3" />}
                        {permLabel(p)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
