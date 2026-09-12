import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TemplateKind } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface TemplateView {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string;
  payload: Record<string, unknown>;
  useCount: number;
  createdAt: string;
}

const key = (w: string): unknown[] => ['templates', w];

export function useTemplates(workspaceId: string) {
  return useQuery({ queryKey: key(workspaceId), queryFn: () => api.get<TemplateView[]>(`/workspaces/${workspaceId}/templates`) });
}
export function useCreateTemplate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: TemplateKind; name: string; description?: string; payload: Record<string, unknown> }) =>
      api.post<TemplateView>(`/workspaces/${workspaceId}/templates`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useDeleteTemplate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/templates/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useInstantiateTemplate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, ...body }: { id: string; kind: TemplateKind; projectId?: string; columnId?: string; name?: string; key?: string }) =>
      api.post<{ created: number; rootTaskId?: string; projectId?: string }>(
        `/workspaces/${workspaceId}/templates/${id}/instantiate-${kind === 'task' ? 'task' : 'project'}`,
        body,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects', workspaceId] });
      void qc.invalidateQueries({ queryKey: key(workspaceId) });
    },
  });
}
