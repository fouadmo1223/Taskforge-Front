import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface TeamView {
  id: string;
  name: string;
  description: string;
  color: string;
  leadUserId: string | null;
  memberUserIds: string[];
  archived: boolean;
  createdAt: string;
}

const key = (w: string): unknown[] => ['teams', w];

export function useTeams(workspaceId: string) {
  return useQuery({ queryKey: key(workspaceId), queryFn: () => api.get<TeamView[]>(`/workspaces/${workspaceId}/teams`) });
}
export function useCreateTeam(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; color?: string; leadUserId?: string | null; memberUserIds?: string[] }) =>
      api.post<TeamView>(`/workspaces/${workspaceId}/teams`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useUpdateTeam(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<TeamView> & { id: string; archived?: boolean }) =>
      api.patch<TeamView>(`/workspaces/${workspaceId}/teams/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useDeleteTeam(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/teams/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
