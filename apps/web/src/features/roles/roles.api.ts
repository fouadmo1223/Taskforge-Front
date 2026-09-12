import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  system: boolean;
  isDefault: boolean;
  isOwner: boolean;
}

const key = (workspaceId: string) => ['roles', workspaceId];

export function useRoles(workspaceId: string) {
  return useQuery({
    queryKey: key(workspaceId),
    queryFn: () => api.get<RoleView[]>(`/workspaces/${workspaceId}/roles`),
  });
}

export function useCreateRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; permissions: Permission[] }) =>
      api.post<RoleView>(`/workspaces/${workspaceId}/roles`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}

export function useUpdateRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      ...body
    }: {
      roleId: string;
      name?: string;
      description?: string;
      permissions?: Permission[];
      isDefault?: boolean;
    }) => api.patch<RoleView>(`/workspaces/${workspaceId}/roles/${roleId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}

export function useDeleteRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => api.delete(`/workspaces/${workspaceId}/roles/${roleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
