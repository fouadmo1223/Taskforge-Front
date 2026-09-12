import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, UserPlus, Users } from 'lucide-react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useAuth } from '@/features/auth/auth.store';
import { useRoles } from '@/features/roles/roles.api';
import {
  useChangeMemberRole,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useSetMemberStatus,
  type MemberView,
} from '@/features/members/members.api';
import { ApiError } from '@/lib/api/client';
import { PageBody, PageHeader } from '@/components/layout/page';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  confirm,
  toast,
} from '@/components/ui';

const inviteSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
  isClient: z.boolean().optional(),
});
type InviteValues = z.infer<typeof inviteSchema>;

export function MembersPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const meId = useAuth((s) => s.user?.id);
  const members = useMembers(workspaceId);
  const roles = useRoles(workspaceId);
  const invite = useInviteMember(workspaceId);
  const changeRole = useChangeMemberRole(workspaceId);
  const setStatus = useSetMemberStatus(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);

  const roleOptions = useMemo(
    () => (roles.data ?? []).filter((r) => !r.isOwner).map((r) => ({ value: r.id, label: r.name })),
    [roles.data],
  );

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', roleId: '', isClient: false },
  });

  const submitInvite = form.handleSubmit(async (values) => {
    try {
      await invite.mutateAsync(values);
      toast.success(t('members.invite'), values.email);
      setInviteOpen(false);
      form.reset({ email: '', roleId: values.roleId, isClient: false });
    } catch (err) {
      toast.error(t('members.invite'), err instanceof ApiError ? err.message : t('errors.generic'));
    }
  });

  const canManage = can('members.invite');
  const canManageRoles = can('roles.manage');
  const canRemove = can('members.remove');

  return (
    <>
      <PageHeader
        title={t('members.title')}
        actions={
          canManage && (
            <Button
              onClick={() => {
                form.reset({ email: '', roleId: roleOptions[0]?.value ?? '', isClient: false });
                setInviteOpen(true);
              }}
            >
              <UserPlus className="size-4" />
              {t('members.invite')}
            </Button>
          )
        }
      />
      <PageBody>
        {members.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : members.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void members.refetch()} retryLabel={t('common.retry')} />
        ) : (members.data ?? []).length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title={t('members.emptyTitle')} description={t('members.emptyBody')} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-xs uppercase tracking-wide text-text-subtle">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{t('members.title')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('members.role')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('members.status')}</th>
                  <th className="w-10 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.data!.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isSelf={m.user?.id === meId}
                    roleOptions={roleOptions}
                    canManageRoles={canManageRoles}
                    canManage={canManage}
                    canRemove={canRemove}
                    onChangeRole={(roleId) =>
                      changeRole
                        .mutateAsync({ membershipId: m.id, roleId })
                        .catch((e: unknown) =>
                          toast.error(t('members.role'), e instanceof ApiError ? e.message : t('errors.generic')),
                        )
                    }
                    onToggleStatus={() =>
                      setStatus
                        .mutateAsync({ membershipId: m.id, status: m.status === 'suspended' ? 'active' : 'suspended' })
                        .catch((e: unknown) =>
                          toast.error(t('members.status'), e instanceof ApiError ? e.message : t('errors.generic')),
                        )
                    }
                    onRemove={async () => {
                      const ok = await confirm({
                        title: t('members.invite'),
                        body: t('members.removeConfirm', { name: m.user?.name ?? m.invitedEmail ?? '' }),
                        tone: 'danger',
                        confirmLabel: t('common.remove'),
                      });
                      if (!ok) return;
                      removeMember
                        .mutateAsync(m.id)
                        .catch((e: unknown) =>
                          toast.error(t('common.remove'), e instanceof ApiError ? e.message : t('errors.generic')),
                        );
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>

      <Dialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={t('members.invite')}
        description={t('members.inviteByEmail')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitInvite} loading={invite.isPending}>
              {t('members.invite')}
            </Button>
          </>
        }
      >
        <form onSubmit={submitInvite} className="flex flex-col gap-4 py-1">
          <Field label={t('auth.email')} error={form.formState.errors.email?.message}>
            <Input type="email" autoFocus placeholder="teammate@company.com" {...form.register('email')} />
          </Field>
          <Field label={t('members.role')} error={form.formState.errors.roleId?.message}>
            <Select
              value={form.watch('roleId')}
              onChange={(v) => form.setValue('roleId', v ?? '', { shouldValidate: true })}
              options={roleOptions}
              loading={roles.isLoading}
              placeholder={t('members.role')}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" className="size-4 rounded border-border" {...form.register('isClient')} />
            {t('members.asClient')}
          </label>
        </form>
      </Dialog>
    </>
  );
}

function MemberRow({
  member,
  isSelf,
  roleOptions,
  canManageRoles,
  canManage,
  canRemove,
  onChangeRole,
  onToggleStatus,
  onRemove,
}: {
  member: MemberView;
  isSelf: boolean;
  roleOptions: { value: string; label: string }[];
  canManageRoles: boolean;
  canManage: boolean;
  canRemove: boolean;
  onChangeRole: (roleId: string) => void;
  onToggleStatus: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const name = member.user?.name ?? member.invitedEmail ?? '—';
  const isOwnerRole = member.role?.key === 'owner';
  const statusTone = member.status === 'active' ? 'success' : member.status === 'invited' ? 'warning' : 'danger';
  const statusLabel =
    member.status === 'active' ? t('members.active') : member.status === 'invited' ? t('members.pending') : t('members.suspended');

  return (
    <tr className="bg-surface transition-colors hover:bg-surface-sunken/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} src={member.user?.email ? null : null} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-text">
              {name}
              {member.isClient && <span className="ms-2 text-xs text-text-subtle">client</span>}
            </p>
            <p className="truncate text-xs text-text-subtle">{member.user?.email ?? member.invitedEmail}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {canManageRoles && !isOwnerRole ? (
          <Select
            size="sm"
            className="max-w-44"
            value={member.role?.id ?? null}
            onChange={(v) => v && onChangeRole(v)}
            options={roleOptions}
          />
        ) : (
          <span className="text-text-muted">{member.role?.name ?? '—'}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </td>
      <td className="px-4 py-3 text-end">
        {!isOwnerRole && !isSelf && (canManage || canRemove) && (
          <Dropdown.Root>
            <Dropdown.Trigger className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-sunken hover:text-text">
              <MoreHorizontal className="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                align="end"
                sideOffset={4}
                className="z-50 w-44 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-pop"
              >
                {canManage && member.status !== 'invited' && (
                  <Dropdown.Item
                    onSelect={onToggleStatus}
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
                  >
                    {member.status === 'suspended' ? t('members.active') : t('members.suspended')}
                  </Dropdown.Item>
                )}
                {canRemove && (
                  <Dropdown.Item
                    onSelect={onRemove}
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                  >
                    {t('common.remove')}
                  </Dropdown.Item>
                )}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        )}
      </td>
    </tr>
  );
}
