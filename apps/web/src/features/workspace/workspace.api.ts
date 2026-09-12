import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuth } from '@/features/auth/auth.store';

export interface WorkspaceView {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  logo: unknown | null;
  settings: {
    primaryColor: string | null;
    secondaryColor: string | null;
    defaultLocale: 'en' | 'ar';
    timezone: string;
    allowConcurrentTimers: boolean;
    clientsSeeFinance: boolean;
  };
  createdAt: string;
}

export function useWorkspaceList() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<WorkspaceView[]>('/workspaces'),
  });
}

export function useWorkspaceDetail(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<WorkspaceView>(`/workspaces/${workspaceId}`),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateWorkspace() {
  const reload = useAuth((s) => s.reloadMemberships);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; defaultLocale?: 'en' | 'ar' }) =>
      api.post<WorkspaceView>('/workspaces', body),
    onSuccess: async () => {
      await reload();
      await qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const reload = useAuth((s) => s.reloadMemberships);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<{ name: string; settings: Partial<WorkspaceView['settings']> }>) =>
      api.patch<WorkspaceView>(`/workspaces/${workspaceId}`, body),
    onSuccess: async (data) => {
      qc.setQueryData(['workspace', workspaceId], data);
      await reload();
    },
  });
}

export function useDeleteWorkspace(workspaceId: string) {
  const reload = useAuth((s) => s.reloadMemberships);
  return useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspaceId}`),
    onSuccess: () => reload(),
  });
}
