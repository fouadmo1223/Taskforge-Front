import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface LabelView {
  id: string;
  name: string;
  color: string;
  projectId: string | null;
}

const key = (w: string) => ['labels', w];

export function useLabels(workspaceId: string) {
  return useQuery({ queryKey: key(workspaceId), queryFn: () => api.get<LabelView[]>(`/workspaces/${workspaceId}/labels`) });
}

export function useCreateLabel(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color?: string; projectId?: string | null }) =>
      api.post<LabelView>(`/workspaces/${workspaceId}/labels`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}

export function useDeleteLabel(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => api.delete(`/workspaces/${workspaceId}/labels/${labelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
