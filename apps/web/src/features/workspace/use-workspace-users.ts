import { useMemo } from 'react';
import type { UserSummary } from '@flowdesk/types';
import { useMembers } from '@/features/members/members.api';

/** Active workspace members as `UserSummary[]` for assignee pickers / avatars. */
export function useWorkspaceUsers(workspaceId: string): { users: UserSummary[]; byId: Map<string, UserSummary>; isLoading: boolean } {
  const members = useMembers(workspaceId);
  return useMemo(() => {
    const users: UserSummary[] = (members.data ?? [])
      .filter((m) => m.user && m.status === 'active')
      .map((m) => ({ id: m.user!.id, name: m.user!.name, email: m.user!.email, avatar: m.user!.avatar }));
    return { users, byId: new Map(users.map((u) => [u.id, u])), isLoading: members.isLoading };
  }, [members.data, members.isLoading]);
}
