import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SlaState, TaskPriority } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface SlaPolicyView {
  id: string;
  name: string;
  active: boolean;
  appliesTo: { projectIds: string[]; priorities: TaskPriority[]; types: string[] };
  responseHours: number;
  resolutionHours: number;
  warnAtPercent: number;
  notifyUserIds: string[];
  escalateToUserIds: string[];
  createdAt: string;
}

export interface SlaTrackerView {
  id: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  projectId: string;
  policyId: string;
  policyName: string;
  startedAt: string;
  responseDueAt: string;
  resolutionDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  state: SlaState;
  escalationLevel: number;
}

export interface SlaPolicyInput {
  name: string;
  active?: boolean;
  responseHours: number;
  resolutionHours: number;
  warnAtPercent?: number;
  appliesTo?: { projectIds?: string[]; priorities?: TaskPriority[]; types?: string[] };
  notifyUserIds?: string[];
  escalateToUserIds?: string[];
}

const policiesKey = (w: string): unknown[] => ['sla-policies', w];
const trackersKey = (w: string): unknown[] => ['sla-trackers', w];

export function useSlaPolicies(workspaceId: string) {
  return useQuery({
    queryKey: policiesKey(workspaceId),
    queryFn: () => api.get<SlaPolicyView[]>(`/workspaces/${workspaceId}/sla/policies`),
  });
}

export function useSlaTrackers(workspaceId: string) {
  return useQuery({
    queryKey: trackersKey(workspaceId),
    queryFn: () => api.get<SlaTrackerView[]>(`/workspaces/${workspaceId}/sla/trackers`),
  });
}

export function useCreateSlaPolicy(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SlaPolicyInput) => api.post<SlaPolicyView>(`/workspaces/${workspaceId}/sla/policies`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: policiesKey(workspaceId) }),
  });
}

export function useUpdateSlaPolicy(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<SlaPolicyInput> & { id: string }) =>
      api.patch<SlaPolicyView>(`/workspaces/${workspaceId}/sla/policies/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: policiesKey(workspaceId) }),
  });
}

export function useDeleteSlaPolicy(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/sla/policies/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: policiesKey(workspaceId) });
      void qc.invalidateQueries({ queryKey: trackersKey(workspaceId) });
    },
  });
}

export function useSlaSweep(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ evaluated: number; warned: number; breached: number; created: number }>(`/workspaces/${workspaceId}/sla/sweep`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: trackersKey(workspaceId) }),
  });
}
