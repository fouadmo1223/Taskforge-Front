import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROJECT_VISIBILITY, type ProjectVisibility } from '@flowdesk/types';
import { Globe, Lock, Users2 } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useWorkspaceUsers } from '@/features/workspace/use-workspace-users';
import { useTeams } from '@/features/teams/teams.api';
import { useSetProjectAccess, type ProjectView } from '@/features/projects/projects.api';
import { errorText } from '@/lib/api/errors';
import { Button, Dialog, Field, MultiSelect, Select, toast } from '@/components/ui';

const VIS_ICON: Record<ProjectVisibility, typeof Globe> = {
  workspace: Globe,
  team: Users2,
  private: Lock,
};

/** Header control: shows a project's visibility and lets `project.update` holders change it. */
export function ProjectAccessButton({ project }: { project: ProjectView }): React.ReactElement | null {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const setAccess = useSetProjectAccess(workspaceId, project.id);
  const teams = useTeams(workspaceId);
  const { users } = useWorkspaceUsers(workspaceId);

  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<ProjectVisibility>(project.visibility);
  const [teamIds, setTeamIds] = useState<string[]>(project.teamIds);
  const [memberIds, setMemberIds] = useState<string[]>(project.memberUserIds);

  useEffect(() => {
    if (open) {
      setVisibility(project.visibility);
      setTeamIds(project.teamIds);
      setMemberIds(project.memberUserIds);
    }
  }, [open, project.visibility, project.teamIds, project.memberUserIds]);

  if (!can('project.update')) {
    const Icon = VIS_ICON[project.visibility];
    return (
      <span className="inline-flex items-center gap-1 text-xs text-text-subtle" title={t(`projectAccess.${project.visibility}`)}>
        <Icon className="size-3.5" />
      </span>
    );
  }

  const Icon = VIS_ICON[project.visibility];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-text-muted hover:bg-surface-sunken hover:text-text"
      >
        <Icon className="size-3.5" />
        <span className="hidden sm:inline">{t(`projectAccess.${project.visibility}`)}</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('projectAccess.title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              loading={setAccess.isPending}
              onClick={() =>
                setAccess.mutate(
                  {
                    visibility,
                    teamIds: visibility === 'team' ? teamIds : [],
                    // additive on top of the visibility mode itself (team members, the
                    // creator and lead always keep access regardless) — so 'team' mode
                    // can still name a few extra people who aren't on any listed team.
                    memberUserIds: visibility === 'workspace' ? project.memberUserIds : memberIds,
                  },
                  {
                    onSuccess: () => {
                      toast.success(t('projectAccess.saved'));
                      setOpen(false);
                    },
                    onError: (e) => toast.error(errorText(e, t)),
                  },
                )
              }
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('projectAccess.whoCanSee')}>
            <Select
              value={visibility}
              onChange={(v) => setVisibility(v ?? 'workspace')}
              options={PROJECT_VISIBILITY.map((v) => ({
                value: v,
                label: t(`projectAccess.${v}`),
                description: t(`projectAccess.${v}Hint`),
              }))}
            />
          </Field>

          {visibility === 'team' && (
            <>
              <Field label={t('projectAccess.teams')}>
                <MultiSelect
                  value={teamIds}
                  onChange={setTeamIds}
                  options={(teams.data ?? []).filter((tm) => !tm.archived).map((tm) => ({ value: tm.id, label: tm.name }))}
                  placeholder={t('projectAccess.pickTeams')}
                />
              </Field>
              <Field label={t('projectAccess.extraMembers')} hint={t('projectAccess.extraMembersHint')}>
                <MultiSelect
                  value={memberIds}
                  onChange={setMemberIds}
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                />
              </Field>
            </>
          )}

          {visibility === 'private' && (
            <Field label={t('projectAccess.members')}>
              <MultiSelect
                value={memberIds}
                onChange={setMemberIds}
                options={users.map((u) => ({ value: u.id, label: u.name }))}
              />
            </Field>
          )}

          <p className="text-xs text-text-subtle">{t('projectAccess.managersNote')}</p>
        </div>
      </Dialog>
    </>
  );
}
