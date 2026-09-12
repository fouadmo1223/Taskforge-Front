import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardWidgetType } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface WidgetDef {
  id: string;
  type: DashboardWidgetType;
  title: string;
  source: string;
  config: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number };
}

export interface DashboardView {
  id: string;
  name: string;
  ownerUserId: string;
  shared: boolean;
  widgets: WidgetDef[];
  createdAt: string;
}

export interface RenderedDashboard extends DashboardView {
  data: Record<string, unknown>;
}

export interface WidgetInput {
  type: DashboardWidgetType;
  title: string;
  source: string;
  config?: Record<string, unknown>;
  layout?: { x: number; y: number; w: number; h: number };
}

const key = (w: string): unknown[] => ['dashboards', w];

export function useDashboards(workspaceId: string) {
  return useQuery({ queryKey: key(workspaceId), queryFn: () => api.get<DashboardView[]>(`/workspaces/${workspaceId}/dashboards`) });
}
export function useDashboardRender(workspaceId: string, id: string | null) {
  return useQuery({
    queryKey: ['dashboard-render', workspaceId, id],
    queryFn: () => api.get<RenderedDashboard>(`/workspaces/${workspaceId}/dashboards/${id}/render`),
    enabled: Boolean(id),
  });
}
export function useCreateDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; shared?: boolean; widgets?: WidgetInput[] }) =>
      api.post<DashboardView>(`/workspaces/${workspaceId}/dashboards`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useUpdateDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; shared?: boolean; widgets?: WidgetInput[] }) =>
      api.patch<DashboardView>(`/workspaces/${workspaceId}/dashboards/${id}`, body),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: key(workspaceId) });
      void qc.invalidateQueries({ queryKey: ['dashboard-render', workspaceId, v.id] });
    },
  });
}
export function useDeleteDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/dashboards/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
