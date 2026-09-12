import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CloudinaryAsset } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface MemberView {
  id: string;
  status: 'invited' | 'active' | 'suspended';
  isClient: boolean;
  user: { id: string; name: string; email: string; avatar: CloudinaryAsset | null } | null;
  invitedEmail: string | null;
  role: { id: string; key: string; name: string } | null;
  joinedAt: string | null;
  createdAt: string;
}

const key = (workspaceId: string) => ['members', workspaceId];

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: key(workspaceId),
    queryFn: () => api.get<MemberView[]>(`/workspaces/${workspaceId}/members`),
  });
}

export function useInviteMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; roleId?: string; isClient?: boolean }) =>
      api.post<MemberView>(`/workspaces/${workspaceId}/members/invites`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}

export function useChangeMemberRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, roleId }: { membershipId: string; roleId: string }) =>
      api.patch<MemberView>(`/workspaces/${workspaceId}/members/${membershipId}/role`, { roleId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}

export function useSetMemberStatus(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, status }: { membershipId: string; status: 'active' | 'suspended' }) =>
      api.patch<MemberView>(`/workspaces/${workspaceId}/members/${membershipId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      api.delete(`/workspaces/${workspaceId}/members/${membershipId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
