import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Users2 } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useWorkspaceUsers } from '@/features/workspace/use-workspace-users';
import { feedback } from '@/lib/api/mutation-feedback';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Avatar, Button, Dialog, EmptyState, ErrorState, Field, Input, MultiSelect, Skeleton, Textarea } from '@/components/ui';
import { UserSelect } from '@/components/ui/select/specialized';
import {
  useCreateTeam,
  useDeleteTeam,
  useTeams,
  useUpdateTeam,
  type TeamView,
} from '@/features/teams/teams.api';

export function TeamsPage(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const teams = useTeams(workspaceId);
  const { users } = useWorkspaceUsers(workspaceId);
  const create = useCreateTeam(workspaceId);
  const update = useUpdateTeam(workspaceId);
  const del = useDeleteTeam(workspaceId);
  const manage = can('team.manage');

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', leadUserId: null as string | null, memberUserIds: [] as string[] });

  const userOpts = users.map((u) => ({ value: u.id, label: u.name }));
  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? '—';
  const userOf = (id: string) => users.find((u) => u.id === id);

  return (
    <>
      <PageHeader
        title={t('teams.title')}
        description={t('teams.description')}
        actions={
          manage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t('teams.newTeam')}
            </Button>
          )
        }
      />
      <PageBody className="space-y-3">
        {teams.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : teams.isError ? (
          <ErrorState title={t('errors.generic')} onRetry={() => void teams.refetch()} />
        ) : teams.data!.length === 0 ? (
          <EmptyState title={t('teams.empty')} description={t('teams.emptyBody')} icon={<Users2 className="size-5" />} />
        ) : (
          teams.data!.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              users={users}
              userOpts={userOpts}
              nameOf={nameOf}
              userOf={userOf}
              canManage={manage}
              onMembers={(memberUserIds) => update.mutate({ id: team.id, memberUserIds }, feedback(t, { success: t('common.updated') }))}
              onLead={(leadUserId) => update.mutate({ id: team.id, leadUserId }, feedback(t, { success: t('common.updated') }))}
              onDelete={() => del.mutate(team.id, feedback(t, { success: t('common.deleted') }))}
            />
          ))
        )}
      </PageBody>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('teams.newTeam')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!draft.name.trim()}
              onClick={() =>
                create.mutate(
                  {
                    name: draft.name.trim(),
                    description: draft.description.trim() || undefined,
                    leadUserId: draft.leadUserId,
                    memberUserIds: draft.memberUserIds,
                  },
                  {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.created') }).onSuccess();
                      setCreating(false);
                      setDraft({ name: '', description: '', leadUserId: null, memberUserIds: [] });
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
          <Field label={t('teams.name')}>
            <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={t('external.forms.formDescription')}>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label={t('teams.lead')}>
            <UserSelect users={users} value={draft.leadUserId} onChange={(v) => setDraft({ ...draft, leadUserId: v })} clearable />
          </Field>
          <Field label={t('teams.members')}>
            <MultiSelect value={draft.memberUserIds} onChange={(v) => setDraft({ ...draft, memberUserIds: v })} options={userOpts} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

function TeamCard({
  team,
  users,
  userOpts,
  nameOf,
  userOf,
  canManage,
  onMembers,
  onLead,
  onDelete,
}: {
  team: TeamView;
  users: ReturnType<typeof useWorkspaceUsers>['users'];
  userOpts: { value: string; label: string }[];
  nameOf: (id: string) => string;
  userOf: (id: string) => ReturnType<typeof useWorkspaceUsers>['users'][number] | undefined;
  canManage: boolean;
  onMembers: (ids: string[]) => void;
  onLead: (id: string | null) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-2.5 rounded" style={{ backgroundColor: team.color }} />
        <span className="font-medium text-text">{team.name}</span>
        <span className="text-xs text-text-subtle">{t('teams.memberCount', { count: team.memberUserIds.length })}</span>
        {team.leadUserId && <span className="text-xs text-text-subtle">· {t('teams.lead')}: {nameOf(team.leadUserId)}</span>}
        {canManage && (
          <div className="ms-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>{t('common.edit')}</Button>
            <button onClick={onDelete} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-danger">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {team.description && <p className="mt-1 text-sm text-text-muted">{team.description}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {team.memberUserIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2 py-0.5 text-xs">
            <Avatar name={nameOf(id)} src={userOf(id)?.avatar ?? null} size="xs" />
            {nameOf(id)}
          </span>
        ))}
      </div>

      {editing && canManage && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <Field label={t('teams.lead')}>
            <UserSelect users={users} value={team.leadUserId} onChange={onLead} clearable />
          </Field>
          <Field label={t('teams.members')}>
            <MultiSelect value={team.memberUserIds} onChange={onMembers} options={userOpts} />
          </Field>
        </div>
      )}
    </div>
  );
}
