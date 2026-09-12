import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CloudinaryAsset, ProjectStatus, ProjectVisibility } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface ProjectView {
  id: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color: string;
  cover: CloudinaryAsset | null;
  leadUserId: string | null;
  memberUserIds: string[];
  visibility: ProjectVisibility;
  teamIds: string[];
  startDate: string | null;
  endDate: string | null;
  archived: boolean;
  defaultBoardId: string | null;
  createdAt: string;
}

const listKey = (w: string) => ['projects', w];

export function useProjects(workspaceId: string, includeArchived = false) {
  return useQuery({
    queryKey: [...listKey(workspaceId), { includeArchived }],
    queryFn: () =>
      api.get<ProjectView[]>(`/workspaces/${workspaceId}/projects`, {
        query: includeArchived ? { includeArchived: 'true' } : {},
      }),
  });
}

export function useProject(workspaceId: string, projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: () => api.get<ProjectView>(`/workspaces/${workspaceId}/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; key?: string; description?: string; color?: string }) =>
      api.post<ProjectView>(`/workspaces/${workspaceId}/projects`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(workspaceId) }),
  });
}

export function useSetProjectAccess(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { visibility?: ProjectVisibility; teamIds?: string[]; memberUserIds?: string[] }) =>
      api.patch<ProjectView>(`/workspaces/${workspaceId}/projects/${projectId}/access`, body),
    onSuccess: (data) => {
      qc.setQueryData(['project', workspaceId, projectId], data);
      void qc.invalidateQueries({ queryKey: listKey(workspaceId) });
    },
  });
}

export function useUpdateProject(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<ProjectView, 'name' | 'description' | 'status' | 'color' | 'leadUserId' | 'startDate' | 'endDate'>>) =>
      api.patch<ProjectView>(`/workspaces/${workspaceId}/projects/${projectId}`, body),
    onSuccess: (data) => {
      qc.setQueryData(['project', workspaceId, projectId], data);
      void qc.invalidateQueries({ queryKey: listKey(workspaceId) });
    },
  });
}

export function useArchiveProject(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, archived }: { projectId: string; archived: boolean }) =>
      api.post(`/workspaces/${workspaceId}/projects/${projectId}/archive`, { archived }),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(workspaceId) }),
  });
}

export function useDeleteProject(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.delete(`/workspaces/${workspaceId}/projects/${projectId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKey(workspaceId) }),
  });
}
