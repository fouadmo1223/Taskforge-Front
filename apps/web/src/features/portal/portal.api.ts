import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MilestoneStatus, StatusCategory, TaskPriority } from '@flowdesk/types';
import { api } from '@/lib/api/client';
import type { ApprovalView, DeliverableView, RequestView } from '@/features/external/external.api';

export interface PortalProjectSummary {
  id: string;
  name: string;
  key: string;
  status: string;
  openTasks: number;
  totalTasks: number;
}

export interface PortalOverview {
  client: { id: string; name: string };
  projects: PortalProjectSummary[];
  pendingApprovals: number;
  openRequests: number;
}

export interface PortalTaskView {
  id: string;
  key: string;
  title: string;
  priority: TaskPriority;
  status: string;
  statusCategory: StatusCategory;
  dueDate: string | null;
  updatedAt: string;
}

export interface PortalMilestoneView {
  id: string;
  name: string;
  date: string;
  status: MilestoneStatus;
  progress: { done: number; total: number };
}

export interface PortalProjectDetail {
  project: PortalProjectSummary;
  tasks: PortalTaskView[];
  milestones: PortalMilestoneView[];
  deliverables: DeliverableView[];
}

export function usePortalOverview(workspaceId: string) {
  return useQuery({
    queryKey: ['portal', workspaceId, 'overview'],
    queryFn: () => api.get<PortalOverview>(`/workspaces/${workspaceId}/portal/overview`),
  });
}

export function usePortalProject(workspaceId: string, projectId: string | null) {
  return useQuery({
    queryKey: ['portal', workspaceId, 'project', projectId],
    queryFn: () => api.get<PortalProjectDetail>(`/workspaces/${workspaceId}/portal/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function usePortalDeliverables(workspaceId: string) {
  return useQuery({
    queryKey: ['portal', workspaceId, 'deliverables'],
    queryFn: () => api.get<DeliverableView[]>(`/workspaces/${workspaceId}/portal/deliverables`),
  });
}

export function usePortalApprovals(workspaceId: string) {
  return useQuery({
    queryKey: ['portal', workspaceId, 'approvals'],
    queryFn: () => api.get<ApprovalView[]>(`/workspaces/${workspaceId}/portal/approvals`),
  });
}

export function usePortalRequests(workspaceId: string) {
  return useQuery({
    queryKey: ['portal', workspaceId, 'requests'],
    queryFn: () => api.get<RequestView[]>(`/workspaces/${workspaceId}/portal/requests`),
  });
}

export function useCreatePortalRequest(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; projectId?: string }) =>
      api.post<RequestView>(`/workspaces/${workspaceId}/portal/requests`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal', workspaceId, 'requests'] });
      void qc.invalidateQueries({ queryKey: ['portal', workspaceId, 'overview'] });
    },
  });
}
